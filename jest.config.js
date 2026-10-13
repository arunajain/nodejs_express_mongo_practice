/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  // Fixed env vars for tests (JWT secrets etc.), loaded before each test file
  setupFiles: ["<rootDir>/jest.setup.js"],
  // Treat .ts files as ES modules (project uses "type": "module")
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "es6" },
      },
    ],
  },
  // Source imports use ".js" (NodeNext style); map them back to the .ts files
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  // Fresh mocks for every test: clears calls + implementations, restores spies
  resetMocks: true,
  restoreMocks: true,
};
