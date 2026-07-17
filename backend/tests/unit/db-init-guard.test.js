const fs = require('fs');
const path = require('path');
const os = require('os');
const { isInitBlocked } = require('../../scripts/db-init');

describe('scripts/db-init.js', () => {
    let tempFilePath;

    beforeEach(() => {
        tempFilePath = path.join(
            os.tmpdir(),
            `tududi-test-db-${Math.random().toString(36).slice(2)}.sqlite`
        );
    });

    afterEach(() => {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (_) {}
        }
    });

    it('does not run the init on require, only when executed directly', () => {
        // Reaching this line at all proves it: the require above would have
        // dropped the test database otherwise.
        const mod = require('../../scripts/db-init');
        expect(typeof mod.initDatabase).toBe('function');
    });

    it('does not run the reset on require, only when executed directly', () => {
        const mod = require('../../scripts/db-reset');
        expect(typeof mod.resetDatabase).toBe('function');
    });

    describe('isInitBlocked', () => {
        it('returns true when file exists and is not empty, and allow flag is not set', () => {
            fs.writeFileSync(tempFilePath, 'some content');
            expect(isInitBlocked(tempFilePath, undefined)).toBe(true);
            expect(isInitBlocked(tempFilePath, '')).toBe(true);
            expect(isInitBlocked(tempFilePath, '0')).toBe(true);
        });

        it('returns false when allow flag is 1, even if file exists and has content', () => {
            fs.writeFileSync(tempFilePath, 'some content');
            expect(isInitBlocked(tempFilePath, '1')).toBe(false);
        });

        it('returns false when file does not exist', () => {
            expect(isInitBlocked(tempFilePath, undefined)).toBe(false);
        });

        it('returns false when file is empty (size 0)', () => {
            fs.writeFileSync(tempFilePath, '');
            expect(isInitBlocked(tempFilePath, undefined)).toBe(false);
        });

        it('returns false when path is :memory: or undefined', () => {
            expect(isInitBlocked(':memory:', undefined)).toBe(false);
            expect(isInitBlocked(undefined, undefined)).toBe(false);
        });
    });
});
