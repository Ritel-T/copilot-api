import config from "@echristian/eslint-config"

export default config({
  ignores: ["web/**", "claude-plugin/**", ".opencode/**"],
  prettier: {
    plugins: ["prettier-plugin-packagejson"],
  },
})
