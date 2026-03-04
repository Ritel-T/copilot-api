import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"

import { PATHS } from "./paths"

let cachedDeviceId: string | null = null
const sessionId = randomUUID()

/**
 * Get the device ID, generating and persisting it if it doesn't exist.
 * The device ID is stable across process restarts.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId
  }

  try {
    const data = await fs.readFile(PATHS.DEVICE_ID_PATH, "utf8")
    cachedDeviceId = data.trim()
    if (cachedDeviceId) {
      return cachedDeviceId
    }
  } catch {
    // File doesn't exist or is unreadable, generate a new one
  }

  const newId = randomUUID()
  try {
    await fs.mkdir(PATHS.APP_DIR, { recursive: true })
    await fs.writeFile(PATHS.DEVICE_ID_PATH, newId, "utf8")
    cachedDeviceId = newId
  } catch {
    // If we can't write, just return the generated ID for this session
    return newId
  }

  return newId
}
/**
 * Get the device ID synchronously. Returns null if not yet initialized.
 */
export function getDeviceIdSync(): string | null {
  return cachedDeviceId
}


/**
 * Get the session ID, which is unique per process start.
 */
export function getSessionId(): string {
  return sessionId
}
