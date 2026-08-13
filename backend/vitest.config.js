const { defineConfig } = require("vitest/config");

process.env.TZ = "Asia/Manila";

module.exports = defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test-vitest/**/*.test.js"],
    fileParallelism: false,
    sequence: { concurrent: false },
    clearMocks: true,
    restoreMocks: true,
  },
});
