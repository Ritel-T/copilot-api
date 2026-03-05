import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"

import { PATHS } from "./paths"

let cachedDeviceId: string | null = null
let initPromise: Promise<string> | null = null
const sessionId = randomUUID()

/**
 * Get the device ID, generating and persisting it if it doesn't exist.
 * The device ID is stable across process restarts.
 */
export async function getDeviceId(): Promise<string> {
  // If already initialized, return cached value
  if (cachedDeviceId) {
    return cachedDeviceId
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise
  }

  // Start initialization
  initPromise = initDeviceId()
  return initPromise
}

async function initDeviceId(): Promise<string> {
  try {
    const data = await fs.readFile(PATHS.DEVICE_ID_PATH, "utf8")
    const existingId = data.trim()
    if (existingId) {
      cachedDeviceId = existingId
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
    cachedDeviceId = newId
  }

  return cachedDeviceId
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
