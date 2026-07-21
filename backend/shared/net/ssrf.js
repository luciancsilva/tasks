'use strict';

const net = require('net');
const dns = require('dns');
const { URL } = require('url');

const MAX_REDIRECTS = 3;

/**
 * Expand an IPv6 literal into its 16 raw bytes.
 *
 * String prefix matching is not enough to classify IPv6: the same address has
 * several legal spellings, and the WHATWG URL parser rewrites the one a user
 * types. `new URL('http://[::ffff:169.254.169.254]/').hostname` comes back as
 * `[::ffff:a9fe:a9fe]`, so any check that greps for the dotted form never fires
 * on a URL-derived hostname. Comparing bytes removes the spelling problem.
 *
 * @param {string} ip
 * @returns {Uint8Array|null} null when the input is not a valid IPv6 literal
 */
function expandIPv6(ip) {
    if (!net.isIPv6(ip)) return null;

    let s = ip.toLowerCase();

    // net.isIPv6() accepts a zone id (fe80::1%eth0); it is not part of the address
    const zone = s.indexOf('%');
    if (zone !== -1) s = s.slice(0, zone);

    // Rewrite a trailing dotted quad (::ffff:1.2.3.4) into two hex groups so the
    // parser below only ever sees hex. Both spellings reach us: raw user input
    // and dns.lookup can emit either.
    const lastColon = s.lastIndexOf(':');
    const tail = s.slice(lastColon + 1);
    if (tail.includes('.')) {
        if (!net.isIPv4(tail)) return null;
        const q = tail.split('.').map(Number);
        s =
            s.slice(0, lastColon + 1) +
            (((q[0] << 8) | q[1]) >>> 0).toString(16) +
            ':' +
            (((q[2] << 8) | q[3]) >>> 0).toString(16);
    }

    const halves = s.split('::');
    if (halves.length > 2) return null;

    const head = halves[0] ? halves[0].split(':') : [];
    const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

    let groups;
    if (halves.length === 2) {
        const fill = 8 - head.length - rest.length;
        if (fill < 0) return null;
        groups = [...head, ...Array(fill).fill('0'), ...rest];
    } else {
        groups = head;
    }
    if (groups.length !== 8) return null;

    const bytes = new Uint8Array(16);
    for (let i = 0; i < 8; i++) {
        const value = parseInt(groups[i], 16);
        if (!Number.isInteger(value) || value < 0 || value > 0xffff)
            return null;
        bytes[i * 2] = value >> 8;
        bytes[i * 2 + 1] = value & 0xff;
    }
    return bytes;
}

/**
 * Private, loopback, link-local or otherwise non-routable IPv4 range.
 * @param {string} ip a string already validated by net.isIPv4()
 */
function isPrivateIPv4(ip) {
    const [a, b] = ip.split('.').map(Number);

    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local — cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast, reserved, broadcast

    return false;
}

/**
 * Private, loopback, link-local, or IPv4-embedding IPv6 range.
 * @param {string} ip a string already validated by net.isIPv6()
 */
function isPrivateIPv6(ip) {
    const b = expandIPv6(ip);
    if (!b) return true; // unparseable → unsafe

    const leadingZeros = (n) => b.subarray(0, n).every((byte) => byte === 0);
    const embeddedIPv4 = (offset) =>
        `${b[offset]}.${b[offset + 1]}.${b[offset + 2]}.${b[offset + 3]}`;

    // ::/96 — unspecified, loopback, and the deprecated IPv4-compatible form.
    // The whole block is non-routable, so reject it wholesale.
    if (leadingZeros(12)) return true;

    // ::ffff:0:0/96 — IPv4-mapped. `::ffff:169.254.169.254` and its URL-parser
    // spelling `::ffff:a9fe:a9fe` land on the same bytes here.
    if (leadingZeros(10) && b[10] === 0xff && b[11] === 0xff) {
        return isPrivateIPv4(embeddedIPv4(12));
    }

    // 64:ff9b::/96 — NAT64. 64:ff9b:1::/48 is local-use, reject wholesale.
    if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) {
        if (b[4] !== 0 || b[5] !== 0) return true;
        return isPrivateIPv4(embeddedIPv4(12));
    }

    // 2002::/16 — 6to4, carries the IPv4 endpoint in bytes 2-5
    if (b[0] === 0x20 && b[1] === 0x02) return isPrivateIPv4(embeddedIPv4(2));

    // 2001::/32 — Teredo tunnelling has no place in an outbound fetch from here
    if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) {
        return true;
    }

    if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
    if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10
    if (b[0] === 0xff) return true; // ff00::/8 multicast

    return false;
}

/**
 * Check whether an IP address falls in a private, loopback, link-local, or
 * otherwise non-routable range. Anything that is not a valid IP is unsafe.
 * @param {string} ip
 */
function isPrivateIP(ip) {
    if (!ip) return true;

    const bare = String(ip).replace(/^\[|\]$/g, '');

    if (net.isIPv4(bare)) return isPrivateIPv4(bare);
    if (net.isIPv6(bare)) return isPrivateIPv6(bare);

    return true;
}

/**
 * Check whether a hostname is private or localhost. For non-IP hostnames this
 * only inspects the string — DNS resolution happens in assertPublicUrl() and in
 * the CalDAV resolveAndValidateHostname().
 * @param {string} hostname
 */
function isPrivateHostname(hostname) {
    if (!hostname) return true;

    const lower = String(hostname)
        .toLowerCase()
        .replace(/^\[|\]$/g, '');

    if (lower === 'localhost') return true;
    if (
        lower.endsWith('.local') ||
        lower.endsWith('.internal') ||
        lower.endsWith('.localhost')
    ) {
        return true;
    }

    if (net.isIP(lower)) return isPrivateIP(lower);

    return false;
}

/**
 * SSRF guard: resolve hostname via DNS, reject if any resolved IP is
 * private/loopback/link-local. Must be called before every outbound fetch AND
 * on every redirect target.
 * @param {string} urlString full URL to validate
 * @throws {Error} if the URL targets a private address
 */
async function assertPublicUrl(urlString) {
    const parsed = new URL(urlString);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('SSRF: only http/https allowed');
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (net.isIP(hostname)) {
        if (isPrivateIP(hostname)) {
            throw new Error('SSRF: private IP blocked');
        }
        return;
    }

    if (isPrivateHostname(hostname)) {
        throw new Error('SSRF: private hostname blocked');
    }

    const addresses = await dns.promises.lookup(hostname, { all: true });
    for (const entry of addresses) {
        if (isPrivateIP(entry.address)) {
            throw new Error('SSRF: resolved IP is private');
        }
    }
}

/**
 * Build a fetch that re-validates every redirect hop.
 *
 * Validating the entry point is not enough for clients that follow redirects on
 * their own (the OpenAI SDK does): a public host can answer 307 with an
 * internal Location and the guard never sees it. CalDAV closes this by refusing
 * redirects outright (maxRedirects: 0); here we follow them, but assert each
 * hop is public first.
 *
 * @param {Function} [baseFetch] defaults to the global fetch, resolved lazily
 */
function createSsrfSafeFetch(baseFetch) {
    return async function ssrfSafeFetch(input, init = {}) {
        const impl =
            baseFetch || (typeof fetch === 'function' ? fetch : undefined);
        if (!impl) {
            throw new Error('Fetch API is not available in this environment');
        }

        let currentUrl =
            typeof input === 'string' ? input : String(input?.url ?? input);
        const options = { ...init, redirect: 'manual' };

        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            const response = await impl(currentUrl, options);

            const status = response?.status;
            if (!status || status < 300 || status > 399) return response;

            const location = response.headers?.get?.('location');
            if (!location) return response;

            // 301/302/303 turn a POST into a GET and drop the body. An
            // OpenAI-compatible endpoint answering those is misconfigured —
            // surface it instead of silently sending a bodiless request.
            if (status !== 307 && status !== 308) {
                throw new Error(
                    `SSRF guard: refusing to follow ${status} redirect`
                );
            }
            if (options.body != null && typeof options.body !== 'string') {
                throw new Error(
                    'SSRF guard: cannot replay a non-text body across a redirect'
                );
            }

            const next = new URL(location, currentUrl).href;
            await assertPublicUrl(next);
            currentUrl = next;
        }

        throw new Error('SSRF guard: too many redirects');
    };
}

module.exports = {
    expandIPv6,
    isPrivateIP,
    isPrivateHostname,
    assertPublicUrl,
    createSsrfSafeFetch,
};
