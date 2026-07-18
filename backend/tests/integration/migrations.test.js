const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Database Migrations', () => {
    it('should run all migrations successfully on a clean database', () => {
        // Create a temporary sqlite database file in the backend/db directory
        // to avoid permission issues and ensure it's in a standard location.
        const dbName = `migration-test-${Date.now()}.sqlite3`;
        const tempDbPath = path.join(__dirname, '..', '..', 'db', dbName);

        if (fs.existsSync(tempDbPath)) {
            fs.unlinkSync(tempDbPath);
        }

        try {
            const envVars = {
                ...process.env,
                NODE_ENV: 'test',
                DB_FILE: tempDbPath,
            };

            // 1. Production deploy logic (start.sh) runs db:init to create the base schema via sync()
            execSync(`node scripts/db-init.js`, {
                cwd: path.join(__dirname, '..', '..'),
                stdio: 'pipe',
                env: envVars,
            });

            // 2. Then it runs db:migrate. This ensures migrations don't crash on raw SQL data updates
            // (since the tables now exist).
            execSync(`npx sequelize-cli db:migrate`, {
                cwd: path.join(__dirname, '..', '..'),
                stdio: 'pipe',
                env: envVars,
            });
        } catch (error) {
            // If it fails, throw the error output
            let errorMessage = `Migration failed.\n`;
            if (error.stdout)
                errorMessage += `STDOUT:\n${error.stdout.toString()}\n`;
            if (error.stderr)
                errorMessage += `STDERR:\n${error.stderr.toString()}\n`;
            throw new Error(errorMessage);
        } finally {
            // Clean up
            if (fs.existsSync(tempDbPath)) {
                try {
                    fs.unlinkSync(tempDbPath);
                } catch (e) {
                    console.error('Failed to clean up temp migration db:', e);
                }
            }
        }
    });
});
