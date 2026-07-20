/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "./",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "<rootDir>/src/__tests__/integration/",
  ],
  setupFiles: ["<rootDir>/src/__tests__/setupEnv.ts"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/__tests__/**",
    "!src/benchmark/**",
    "!src/phase1.ts",
    "!src/phase2.ts",
    "!src/runConsumer.ts",
  ],
};
