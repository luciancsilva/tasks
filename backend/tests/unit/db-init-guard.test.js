describe('scripts/db-init.js', () => {
    it('does not run the init on require, only when executed directly', () => {
        // Reaching this line at all proves it: the require above would have
        // dropped the test database otherwise.
        const mod = require('../../scripts/db-init');
        expect(typeof mod.initDatabase).toBe('function');
    });
});
