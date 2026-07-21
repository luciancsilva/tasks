const {
    expandIPv6,
    isPrivateIP,
    isPrivateHostname,
    assertPublicUrl,
    createSsrfSafeFetch,
} = require('../../shared/net/ssrf');

// Plan 75. The guard used to match IPv6 by string prefix, which misses every
// form that embeds an IPv4 address. The trap: `new URL()` rewrites the address
// a user types, so `https://[::ffff:169.254.169.254]/` reaches the guard as
// `::ffff:a9fe:a9fe` — the dotted spelling never appears at the check.
describe('expandIPv6', () => {
    it('maps every spelling of the same address to the same bytes', () => {
        const canonical = Array.from(expandIPv6('::ffff:a9fe:a9fe'));

        expect(Array.from(expandIPv6('::ffff:169.254.169.254'))).toEqual(
            canonical
        );
        expect(
            Array.from(expandIPv6('0:0:0:0:0:ffff:169.254.169.254'))
        ).toEqual(canonical);
        expect(Array.from(expandIPv6('::FFFF:A9FE:A9FE'))).toEqual(canonical);
    });

    it('strips the zone id that net.isIPv6 accepts', () => {
        expect(Array.from(expandIPv6('fe80::1%eth0'))).toEqual(
            Array.from(expandIPv6('fe80::1'))
        );
    });

    it('returns null for non-IPv6 input', () => {
        expect(expandIPv6('10.0.0.1')).toBeNull();
        expect(expandIPv6('not-an-ip')).toBeNull();
    });
});

describe('isPrivateIP', () => {
    it.each([
        '127.0.0.1',
        '10.0.0.5',
        '172.16.0.1',
        '192.168.1.1',
        '169.254.169.254',
        '0.0.0.0',
        '100.64.0.1',
        '198.18.0.1',
        '255.255.255.255',
    ])('rejects the private IPv4 %s', (ip) => {
        expect(isPrivateIP(ip)).toBe(true);
    });

    it.each(['93.184.216.34', '8.8.8.8', '1.1.1.1'])(
        'accepts the public IPv4 %s',
        (ip) => {
            expect(isPrivateIP(ip)).toBe(false);
        }
    );

    it.each([
        '::1',
        '::',
        '0000:0000:0000:0000:0000:0000:0000:0001',
        'fc00::1',
        'fd12:3456::1',
        'fe80::1',
        'ff02::1',
    ])('rejects the private IPv6 %s', (ip) => {
        expect(isPrivateIP(ip)).toBe(true);
    });

    it.each([
        // IPv4-mapped, in both the dotted and the URL-parser spelling
        '::ffff:169.254.169.254',
        '::ffff:a9fe:a9fe',
        '::ffff:10.0.0.1',
        '::ffff:a00:1',
        '0:0:0:0:0:ffff:127.0.0.1',
        // 6to4 and NAT64 carry an IPv4 endpoint too
        '2002:a9fe:a9fe::1',
        '64:ff9b::a9fe:a9fe',
    ])('rejects the IPv4-embedding IPv6 %s', (ip) => {
        expect(isPrivateIP(ip)).toBe(true);
    });

    it.each([
        '2001:4860:4860::8888',
        '::ffff:93.184.216.34',
        '2002:5db8:d822::1',
    ])('accepts the public IPv6 %s', (ip) => {
        expect(isPrivateIP(ip)).toBe(false);
    });

    it('treats anything that is not an IP as unsafe', () => {
        expect(isPrivateIP('')).toBe(true);
        expect(isPrivateIP(null)).toBe(true);
        expect(isPrivateIP('example.com')).toBe(true);
    });
});

describe('isPrivateHostname', () => {
    it.each([
        'localhost',
        'foo.local',
        'db.internal',
        'api.localhost',
        '[::ffff:a9fe:a9fe]',
    ])('rejects %s', (host) => {
        expect(isPrivateHostname(host)).toBe(true);
    });

    it('accepts a public hostname', () => {
        expect(isPrivateHostname('example.com')).toBe(false);
    });
});

describe('assertPublicUrl', () => {
    it('rejects an IPv4-mapped IPv6 literal without touching DNS', async () => {
        await expect(
            assertPublicUrl('https://[::ffff:169.254.169.254]/v1')
        ).rejects.toThrow(/private IP/i);
    });

    it('rejects a non-http protocol', async () => {
        await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow(
            /http\/https/i
        );
    });
});

describe('createSsrfSafeFetch', () => {
    const redirectTo = (location, status = 307) => ({
        status,
        headers: { get: (name) => (name === 'location' ? location : null) },
    });
    const ok = { status: 200, headers: { get: () => null } };

    it('passes a non-redirect response straight through', async () => {
        const base = jest.fn().mockResolvedValue(ok);
        const safeFetch = createSsrfSafeFetch(base);

        await expect(safeFetch('https://llm.example.com/v1')).resolves.toBe(ok);
        expect(base.mock.calls[0][1].redirect).toBe('manual');
    });

    it('blocks a redirect that points at a private address', async () => {
        const base = jest
            .fn()
            .mockResolvedValue(
                redirectTo('http://169.254.169.254/latest/meta-data')
            );

        await expect(
            createSsrfSafeFetch(base)('https://llm.example.com/v1')
        ).rejects.toThrow(/SSRF/i);
        expect(base).toHaveBeenCalledTimes(1);
    });

    it('follows a redirect to a public address', async () => {
        const base = jest
            .fn()
            .mockResolvedValueOnce(
                redirectTo('https://[2001:4860:4860::8888]/v2')
            )
            .mockResolvedValueOnce(ok);

        await expect(
            createSsrfSafeFetch(base)('https://llm.example.com/v1')
        ).resolves.toBe(ok);
        expect(base.mock.calls[1][0]).toContain('2001:4860:4860::8888');
    });

    it('refuses a body-dropping 302 instead of replaying it as a GET', async () => {
        const base = jest
            .fn()
            .mockResolvedValue(redirectTo('https://other.example.com/v1', 302));

        await expect(
            createSsrfSafeFetch(base)('https://llm.example.com/v1', {
                method: 'POST',
                body: '{}',
            })
        ).rejects.toThrow(/refusing to follow 302/i);
    });

    it('gives up after too many redirects', async () => {
        const base = jest
            .fn()
            .mockResolvedValue(redirectTo('https://93.184.216.34/next'));

        await expect(
            createSsrfSafeFetch(base)('https://llm.example.com/v1')
        ).rejects.toThrow(/too many redirects/i);
    });
});
