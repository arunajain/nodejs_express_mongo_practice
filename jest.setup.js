// Runs before every test file, before any imports.
// dotenv never overrides variables that are already set, so these values win
// over the developer's .env and tests behave the same on every machine.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.DOTENV_CONFIG_QUIET = "true"; // hide dotenv "injected env" log
