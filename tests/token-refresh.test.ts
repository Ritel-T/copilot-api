import { describe, expect, it, spyOn, afterEach, beforeEach } from "bun:test"
import consola from "consola"

import { state } from "~/lib/state"
import { setupCopilotToken } from "~/lib/token"
import * as getCopilotTokenModule from "~/services/github/get-copilot-token"

describe("setupCopilotToken", () => {
  let getCopilotTokenSpy: any

  beforeEach(() => {
    state.copilotToken = undefined
    getCopilotTokenSpy = spyOn(getCopilotTokenModule, "getCopilotToken")
  })

  afterEach(() => {
    if (getCopilotTokenSpy) {
      getCopilotTokenSpy.mockRestore()
    }
  })

  it("should refresh the token using setInterval and handle mutex", async () => {
    let callCount = 0
    let resolveRefresh: (value: any) => void
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve as any
    })

    getCopilotTokenSpy.mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return {
          expires_at: Date.now() + 61000,
          refresh_in: 61,
          token: "token1",
        }
      }
      // Second call: wait for signal to simulate long running task
      await refreshPromise
      return {
        expires_at: Date.now() + 61000,
        refresh_in: 61,
        token: `token${callCount}`,
      }
    })

    let intervalId: any
    const originalSetInterval = globalThis.setInterval
    // @ts-expect-error - mocking setInterval
    globalThis.setInterval = (cb: any, ms: number) => {
      intervalId = originalSetInterval(cb, ms)
      return intervalId
    }

    try {
      await setupCopilotToken()
      expect(state.copilotToken).toBe("token1")
      expect(callCount).toBe(1)

      // Wait for the interval to trigger (1000ms)
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Refresh should have started but not finished
      expect(callCount).toBe(2)
      expect(state.copilotToken).toBe("token1")

      // Signal refresh to finish
      if (resolveRefresh!) {
        resolveRefresh({})
      }

      // Wait for async callback to complete
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(state.copilotToken).toBe("token2")
    } finally {
      globalThis.setInterval = originalSetInterval
      if (intervalId) clearInterval(intervalId)
    }
  })

  it("should log error and continue if refresh fails", async () => {
    const consolaErrorSpy = spyOn(consola, "error").mockImplementation(() => {})

    let callCount = 0
    getCopilotTokenSpy.mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return {
          expires_at: Date.now() + 61000,
          refresh_in: 61,
          token: "token1",
        }
      }
      throw new Error("Refresh failed")
    })

    let intervalId: any
    const originalSetInterval = globalThis.setInterval
    // @ts-expect-error - mocking setInterval
    globalThis.setInterval = (cb: any, ms: number) => {
      intervalId = originalSetInterval(cb, ms)
      return intervalId
    }

    try {
      await setupCopilotToken()
      expect(state.copilotToken).toBe("token1")

      // Wait for interval
      await new Promise((resolve) => setTimeout(resolve, 1100))

      expect(callCount).toBe(2)
      expect(consolaErrorSpy).toHaveBeenCalled()
      expect(state.copilotToken).toBe("token1")
    } finally {
      globalThis.setInterval = originalSetInterval
      if (intervalId) clearInterval(intervalId)
      consolaErrorSpy.mockRestore()
    }
  })
})
