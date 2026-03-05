import { describe, expect, it, afterEach, beforeEach } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { getDeviceId, getSessionId } from "../src/lib/device-id"
import { PATHS } from "../src/lib/paths"

describe("device-id", () => {
  const TEST_DEVICE_ID_PATH = path.join(
    os.tmpdir(),
    `test-device-id-${Date.now()}`,
  )
  const ORIGINAL_DEVICE_ID_PATH = PATHS.DEVICE_ID_PATH

  beforeEach(() => {
    // Override PATHS for testing persistence
    // @ts-expect-error - test-only override
    PATHS.DEVICE_ID_PATH = TEST_DEVICE_ID_PATH
  })

  afterEach(async () => {
    // Restore and cleanup
    // @ts-expect-error - test-only override
    PATHS.DEVICE_ID_PATH = ORIGINAL_DEVICE_ID_PATH
    await fs.unlink(TEST_DEVICE_ID_PATH).catch(() => {
      // Ignore if file doesn't exist
    })
  })

  it("getSessionId returns a stable value during the same process", () => {
    const id1 = getSessionId()
    const id2 = getSessionId()
    expect(id1).toBe(id2)
    expect(id1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it("getDeviceId persists the ID to disk", async () => {
    // Clear cache by reloading module logic (since it's a singleton)
    // For testing purposes, we just rely on the fact that if the file doesn't exist, it creates one.

    // 1. Get first time (generates and writes)
    const id1 = await getDeviceId()
    expect(id1).toBeDefined()

    // 2. Verify file exists
    const fileContent = await fs.readFile(TEST_DEVICE_ID_PATH, "utf8")
    expect(fileContent).toBe(id1)

    // 3. Subsequent calls return same ID (cached)
    const id2 = await getDeviceId()
    expect(id1).toBe(id2)
  })
})
