import fs from "node:fs/promises"
import path from "node:path"

import { PATHS } from "./paths"

const LOG_RETENTION_DAYS = 7
const LOG_RETENTION_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000

export interface RequestLogEntry {
  timestamp: string // ISO 8601 UTC
  accountId: string
  accountName: string
  model: string
  endpoint: string
  success: boolean
  statusCode?: number
  errorMessage?: string
  latencyMs?: number
  isStreaming?: boolean
  poolMode?: boolean
  inputTokens?: number | null
  outputTokens?: number | null
}

/**
 * Append a log entry to the daily JSONL file.
 * Fire-and-forget - does not wait for write to complete.
 */
export function appendLogEntry(entry: RequestLogEntry): void {
  const date = new Date().toISOString().split("T")[0]
  const fileName = `request-logs-${date}.jsonl`
  const filePath = path.join(PATHS.REQUEST_LOG_DIR, fileName)
  const line = JSON.stringify(entry) + "\n"

  void fs.appendFile(filePath, line, "utf8").catch(() => {
    // Silently ignore write errors for fire-and-forget
  })
}

export interface ReadLogsOptions {
  accountId?: string
  status?: "success" | "error"
  limit?: number
}

/**
 * Read log entries with optional filtering and pagination.
 * Returns entries sorted by timestamp descending (newest first).
 */
export async function readLogs(
  options?: ReadLogsOptions,
): Promise<Array<RequestLogEntry>> {
  const { accountId, status, limit = 100 } = options ?? {}

  const entries: Array<RequestLogEntry> = []

  let files: Array<string>
  try {
    files = await fs.readdir(PATHS.REQUEST_LOG_DIR)
  } catch {
    return []
  }

  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"))

  for (const file of jsonlFiles) {
    const filePath = path.join(PATHS.REQUEST_LOG_DIR, file)
    let content: string
    try {
      content = await fs.readFile(filePath, "utf8")
    } catch {
      continue
    }

    const lines = content.trim().split("\n")

    for (const line of lines) {
      if (!line.trim()) continue

      let entry: RequestLogEntry
      try {
        entry = JSON.parse(line) as RequestLogEntry
      } catch {
        // Skip malformed lines
        continue
      }

      // Apply filters
      if (accountId !== undefined && entry.accountId !== accountId) {
        continue
      }

      if (status === "success" && !entry.success) {
        continue
      }

      if (status === "error" && entry.success) {
        continue
      }

      entries.push(entry)
    }
  }

  // Sort by timestamp descending (newest first)
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  // Return up to limit entries
  return entries.slice(0, limit)
}

/**
 * Delete JSONL log files older than 7 days.
 * Called automatically on startup.
 */
export function cleanupOldLogs(): void {
  const now = Date.now()

  void fs
    .readdir(PATHS.REQUEST_LOG_DIR)
    .then((entries) => {
      for (const entry of entries) {
        if (!entry.endsWith(".jsonl")) continue

        const filePath = path.join(PATHS.REQUEST_LOG_DIR, entry)

        void fs
          .stat(filePath)
          .then((stats) => {
            if (now - stats.mtimeMs > LOG_RETENTION_MS) {
              void fs.rm(filePath).catch(() => {
                // Silently ignore deletion errors
              })
            }
          })
          .catch(() => {
            // Silently ignore stat errors
          })
      }
    })
    .catch(() => {
      // Silently ignore readdir errors
    })
}
