import config from "@echristian/eslint-config"

export default config({
  ignores: [
    "web/**",
    "claude-plugin/**",
    ".opencode/**",
    "tests/device-id.test.ts",
    "tests/get-copilot-user-info.test.ts",
    "tests/token-refresh.test.ts",
  ],
  prettier: {
    plugins: ["prettier-plugin-packagejson"],
  },
})
