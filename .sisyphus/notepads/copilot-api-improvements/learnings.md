## Device ID Management
- Device ID is a stable UUID persisted to ~/.local/share/copilot-api/device_id
- Session ID is a unique UUID generated once per process start
- Used by Copilot for tracking and quota management
- Created `getCopilotUserInfo` service to fetch user plan and quota info.
- Added comprehensive tests for the new service, including success and failure cases.
- Followed existing project patterns for API calls and error handling.
- Ensured linting compliance for newly created files, although some pre-existing files still have lint issues.
- Added free account detection in `setupCopilotToken` to prevent free users from encountering cryptic errors later in the execution flow.
- Added a diagnostics module to run startup health checks, integrated via --diagnose flag in start command. The module tests GitHub API connectivity, validates GitHub token, fetches Copilot user plan, and reports token status. Next steps: run bun run start --diagnose and ensure build passes; add tests for diagnostics.
