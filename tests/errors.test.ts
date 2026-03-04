import { describe, expect, it } from "bun:test"

import { CopilotError, CopilotErrorCode } from "~/lib/errors"

describe("CopilotError", () => {
  it("should create a CopilotError with default values", () => {
    const error = new CopilotError("Test error")
    expect(error.message).toBe("Test error")
    expect(error.code).toBe(CopilotErrorCode.UNKNOWN)
    expect(error.name).toBe("CopilotError")
  })

  it("should create a CopilotError with specific code and options", () => {
    const headers = new Headers({ "x-test": "value" })
    const error = new CopilotError(
      "Custom error",
      CopilotErrorCode.AUTH_GITHUB_TOKEN_INVALID,
      {
        httpStatus: 401,
        httpHeaders: headers,
      },
    )
    expect(error.message).toBe("Custom error")
    expect(error.code).toBe(CopilotErrorCode.AUTH_GITHUB_TOKEN_INVALID)
    expect(error.httpStatus).toBe(401)
    expect(error.httpHeaders).toBe(headers)
  })

  describe("fromHTTPError", () => {
    it("should map 401 to AUTH_GITHUB_TOKEN_INVALID", () => {
      const response = new Response(null, { status: 401 })
      const error = CopilotError.fromHTTPError(response)
      expect(error.code).toBe(CopilotErrorCode.AUTH_GITHUB_TOKEN_INVALID)
    })

    it("should map 403 with x-ratelimit-remaining=0 to PERMISSION_RATE_LIMITED", () => {
      const response = new Response(null, {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      })
      const error = CopilotError.fromHTTPError(response)
      expect(error.code).toBe(CopilotErrorCode.PERMISSION_RATE_LIMITED)
    })

    it("should map 403 to PERMISSION_INSUFFICIENT by default", () => {
      const response = new Response(null, { status: 403 })
      const error = CopilotError.fromHTTPError(response)
      expect(error.code).toBe(CopilotErrorCode.PERMISSION_INSUFFICIENT)
    })

    it("should map 429 to PERMISSION_RATE_LIMITED", () => {
      const response = new Response(null, { status: 429 })
      const error = CopilotError.fromHTTPError(response)
      expect(error.code).toBe(CopilotErrorCode.PERMISSION_RATE_LIMITED)
    })

    it("should map 404 to API_MODEL_NOT_FOUND", () => {
      const response = new Response(null, { status: 404 })
      const error = CopilotError.fromHTTPError(response)
      expect(error.code).toBe(CopilotErrorCode.API_MODEL_NOT_FOUND)
    })

    it("should map 400 to API_INVALID_REQUEST", () => {
      const response = new Response(null, { status: 400 })
      const error = CopilotError.fromHTTPError(response)
      expect(error.code).toBe(CopilotErrorCode.API_INVALID_REQUEST)
    })

    it("should map 5xx to NETWORK_CONNECTION_FAILED", () => {
      const response = new Response(null, { status: 500 })
      const error = CopilotError.fromHTTPError(response)
      expect(error.code).toBe(CopilotErrorCode.NETWORK_CONNECTION_FAILED)
    })

    it("should use custom message if provided", () => {
      const response = new Response(null, { status: 500 })
      const error = CopilotError.fromHTTPError(
        response,
        "Custom failure message",
      )
      expect(error.message).toBe("Custom failure message")
    })
  })
})
