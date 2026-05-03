module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  modulePathIgnorePatterns: ["<rootDir>/dir/"],
  testPathIgnorePatterns: ["<rootDir>/src/tests/api.test.ts"],
};
