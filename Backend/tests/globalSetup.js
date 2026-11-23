const { execSync } = require('child_process');
const path = require('path');

/** Recreates the test database from scratch (migrations + seeds) before the run. */
module.exports = async () => {
  const cwd = path.join(__dirname, '..');
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: process.env.JWT_SECRET || 'test-secret-that-is-long-enough-for-validation-0123456789',
    SEED_ADMIN_LOGIN: '',
    SEED_ADMIN_PASSWORD: '',
  };
  const run = (command) => execSync(`npx sequelize-cli ${command}`, { cwd, env, stdio: 'ignore' });
  try { run('db:drop'); } catch { /* database did not exist yet */ }
  run('db:create');
  run('db:migrate');
  run('db:seed:all');
};
