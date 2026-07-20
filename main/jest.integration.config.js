/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "./",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  testMatch: ["<rootDir>/src/__tests__/integration/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  setupFiles: ["<rootDir>/src/__tests__/setupEnv.ts"],
  clearMocks: true,
  testTimeout: 15000,
};
