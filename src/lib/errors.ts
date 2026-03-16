export const CopilotErrorCode = {
  AUTH_GITHUB_TOKEN_INVALID: "AUTH_GITHUB_TOKEN_INVALID",
  AUTH_COPILOT_TOKEN_EXPIRED: "AUTH_COPILOT_TOKEN_EXPIRED",
  PERMISSION_INSUFFICIENT: "PERMISSION_INSUFFICIENT",
  PERMISSION_RATE_LIMITED: "PERMISSION_RATE_LIMITED",
  PERMISSION_FREE_PLAN: "PERMISSION_FREE_PLAN",
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  NETWORK_CONNECTION_FAILED: "NETWORK_CONNECTION_FAILED",
  API_MODEL_NOT_FOUND: "API_MODEL_NOT_FOUND",
  API_INVALID_REQUEST: "API_INVALID_REQUEST",
  UNKNOWN: "UNKNOWN",
} as const

export type CopilotErrorCodeType =
  (typeof CopilotErrorCode)[keyof typeof CopilotErrorCode]

export class CopilotError extends Error {
  code: CopilotErrorCodeType
  httpStatus?: number
  httpHeaders?: Headers

  constructor(
    message: string,
    code: CopilotErrorCodeType = CopilotErrorCode.UNKNOWN,
    options?: { httpStatus?: number; httpHeaders?: Headers },
  ) {
    super(message)
    this.name = "CopilotError"
    this.code = code
    this.httpStatus = options?.httpStatus
    this.httpHeaders = options?.httpHeaders
  }

  static fromHTTPError(response: Response, message?: string): CopilotError {
    const status = response.status
    const headers = response.headers
    let code: CopilotErrorCodeType = CopilotErrorCode.UNKNOWN

    switch (status) {
      case 401: {
        code = CopilotErrorCode.AUTH_GITHUB_TOKEN_INVALID

        break
      }
      case 403: {
        // Check for specific Copilot error types if possible, otherwise default to PERMISSION_INSUFFICIENT
        // Some headers or response bodies might indicate rate limiting or plan issues
        const xRateLimitRemaining = headers.get("x-ratelimit-remaining")
        code =
          xRateLimitRemaining === "0" ?
            CopilotErrorCode.PERMISSION_RATE_LIMITED
          : CopilotErrorCode.PERMISSION_INSUFFICIENT

        break
      }
      case 429: {
        code = CopilotErrorCode.PERMISSION_RATE_LIMITED

        break
      }
      case 404: {
        code = CopilotErrorCode.API_MODEL_NOT_FOUND

        break
      }
      case 400: {
        code = CopilotErrorCode.API_INVALID_REQUEST

        break
      }
      default: {
        if (status >= 500) {
          code = CopilotErrorCode.NETWORK_CONNECTION_FAILED
        }
      }
    }

    return new CopilotError(
      message ?? `Request failed with status ${status}`,
      code,
      {
        httpStatus: status,
        httpHeaders: headers,
      },
    )
  }
}
