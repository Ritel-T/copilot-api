/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable require-atomic-updates */
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
    getCopilotTokenSpy.mockRestore()
  })

  it("should refresh the token using setInterval and handle mutex", async () => {
    let callCount = 0
    let resolveRefresh: ((value: unknown) => void) | undefined
    const refreshPromise = new Promise<unknown>((resolve) => {
      resolveRefresh = resolve
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
    // @ts-expect-error - mocking setInterval for testing
    globalThis.setInterval = (cb: () => void, ms: number) => {
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
      resolveRefresh?.({})

      // Wait for async callback to complete
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(state.copilotToken).toBe("token2")
    } finally {
      const savedIntervalId = intervalId
      globalThis.setInterval = originalSetInterval
      if (savedIntervalId) clearInterval(savedIntervalId)
    }
  })

  it("should log error and continue if refresh fails", async () => {
    // @ts-expect-error - spyOn type mismatch with consola methods
    const consolaErrorSpy = spyOn(consola, "error")
    // @ts-expect-error - mockImplementation type mismatch
    consolaErrorSpy.mockImplementation(() => {})

    let callCount = 0
    // eslint-disable-next-line @typescript-eslint/require-await
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
    // @ts-expect-error - mocking setInterval for testing
    globalThis.setInterval = (cb: () => void, ms: number) => {
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
      const savedIntervalId = intervalId
      globalThis.setInterval = originalSetInterval
      if (savedIntervalId) clearInterval(savedIntervalId)
      consolaErrorSpy.mockRestore()
    }
  })
})
