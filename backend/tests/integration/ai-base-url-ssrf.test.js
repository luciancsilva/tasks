const dns = require('dns');
const { getOpenAIClient } = require('../../modules/ai-assistant/service');

// Plan 71 hardening: the custom ai_base_url is validated at REQUEST time (not
// only at save time) because the config is stored once and consumed by the
// daily-brief cron for days. getOpenAIClient resolves the host via DNS and
// rejects any private/loopback/link-local target, closing an authenticated
// SSRF (DNS rebinding) that the save-time literal check alone left open.
describe('ai_base_url SSRF guard at request time', () => {
    let lookupSpy;

    afterEach(() => {
        if (lookupSpy) lookupSpy.mockRestore();
        lookupSpy = undefined;
    });

    const customUser = (base) => ({
        ai_provider: 'custom',
        ai_api_key: 'sk-test',
        ai_base_url: base,
    });

    it('rejects a custom base URL whose hostname resolves to a private IP', async () => {
        lookupSpy = jest
            .spyOn(dns.promises, 'lookup')
            .mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);

        await expect(
            getOpenAIClient(customUser('https://rebind.example.com/v1'))
        ).rejects.toThrow(/private|SSRF/i);
    });

    it('accepts a custom base URL whose hostname resolves to a public IP', async () => {
        lookupSpy = jest
            .spyOn(dns.promises, 'lookup')
            .mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

        const client = await getOpenAIClient(
            customUser('https://llm.example.com/v1')
        );
        expect(client).toBeDefined();
        expect(String(client.baseURL)).toContain('llm.example.com');
    });

    it('rejects a custom base URL that is a private IP literal (no DNS needed)', async () => {
        lookupSpy = jest.spyOn(dns.promises, 'lookup');
        await expect(
            getOpenAIClient(customUser('https://10.0.0.5/v1'))
        ).rejects.toThrow(/private|SSRF/i);
        expect(lookupSpy).not.toHaveBeenCalled();
    });

    // Plan 75: `new URL()` rewrites this host to `::ffff:a9fe:a9fe`, so the old
    // prefix-matching guard saw an unknown IPv6 and let the metadata endpoint
    // through.
    it('rejects an IPv4-mapped IPv6 literal pointing at cloud metadata', async () => {
        lookupSpy = jest.spyOn(dns.promises, 'lookup');
        await expect(
            getOpenAIClient(customUser('https://[::ffff:169.254.169.254]/v1'))
        ).rejects.toThrow(/private|SSRF/i);
        expect(lookupSpy).not.toHaveBeenCalled();
    });

    it('installs the redirect-revalidating fetch on custom providers only', async () => {
        lookupSpy = jest
            .spyOn(dns.promises, 'lookup')
            .mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

        const custom = await getOpenAIClient(
            customUser('https://llm.example.com/v1')
        );
        expect(typeof custom._options.fetch).toBe('function');

        const openai = await getOpenAIClient({
            ai_provider: 'openai',
            ai_api_key: 'sk-test',
        });
        expect(openai._options.fetch).toBeUndefined();
    });

    it('rejects a non-HTTPS custom base URL', async () => {
        await expect(
            getOpenAIClient(customUser('http://llm.example.com/v1'))
        ).rejects.toThrow(/HTTPS/i);
    });

    it('does not resolve DNS for the default openai provider', async () => {
        lookupSpy = jest.spyOn(dns.promises, 'lookup');
        const client = await getOpenAIClient({
            ai_provider: 'openai',
            ai_api_key: 'sk-test',
        });
        expect(client).toBeDefined();
        expect(lookupSpy).not.toHaveBeenCalled();
    });
});
