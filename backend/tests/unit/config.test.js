describe('Config warnings in production', () => {
    let warnSpy;
    let originalEnv;

    beforeAll(() => {
        originalEnv = { ...process.env };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.resetModules();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('should warn when TUDUDI_SESSION_SECRET and ENCRYPTION_KEY are missing in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.TUDUDI_SESSION_SECRET;
        delete process.env.ENCRYPTION_KEY;
        delete process.env.SECRET_KEY;

        require('../../config/config');

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('TUDUDI_SESSION_SECRET is not set')
        );
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('ENCRYPTION_KEY or SECRET_KEY is not set')
        );
    });

    it('should not warn when TUDUDI_SESSION_SECRET and ENCRYPTION_KEY are provided in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.TUDUDI_SESSION_SECRET = 'some-secret';
        process.env.ENCRYPTION_KEY = 'some-encryption-key';

        require('../../config/config');

        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not warn when in test environment even if env vars are missing', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.TUDUDI_SESSION_SECRET;
        delete process.env.ENCRYPTION_KEY;
        delete process.env.SECRET_KEY;

        require('../../config/config');

        expect(warnSpy).not.toHaveBeenCalled();
    });
});
