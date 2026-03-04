## Device ID Storage
- Decided to store device_id in the same APP_DIR as other config files to keep it centralized
- Used randomUUID from node:crypto as it is modern and built-in
- Decisions: Use `process.exit(1)` for free users to ensure the process stops immediately after logging the clear error message.
