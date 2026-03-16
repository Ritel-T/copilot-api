import { describe, expect, it, spyOn, beforeEach } from "bun:test"

import { HTTPError } from "~/lib/error"
import { state } from "~/lib/state"
import {
  type CopilotUserInfo,
  getCopilotUserInfo,
} from "~/services/github/get-copilot-user-info"

describe("getCopilotUserInfo", () => {
  beforeEach(() => {
    state.githubToken = "test-token"
  })

  it("should fetch user info successfully", async () => {
    const mockUserInfo = {
      copilot_plan: "individual",
      quota_snapshots: {
        chat: { percent_remaining: 80 },
        completions: { percent_remaining: 90 },
      },
      quota_reset_date: "2026-03-04T00:00:00Z",
      organization_login_list: ["org1"],
    }

    // @ts-expect-error - spyOn type mismatch with globalThis.fetch
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockUserInfo), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )

    const userInfo = await getCopilotUserInfo()

    expect(userInfo).toEqual(mockUserInfo as unknown as CopilotUserInfo)
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/copilot_internal/user",
      expect.any(Object),
    )

    fetchSpy.mockRestore()
  })

  it("should throw HTTPError on failure", async () => {
    // @ts-expect-error - spyOn type mismatch with globalThis.fetch
    const fetchSpy = spyOn(globalThis, "fetch")
    fetchSpy.mockImplementationOnce(() =>
      Promise.resolve(new Response("Not Found", { status: 404 })),
    )

    try {
      await getCopilotUserInfo()
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(HTTPError)
      expect((error as HTTPError).message).toBe(
        "Failed to get Copilot user info",
      )
    }

    fetchSpy.mockRestore()
  })
})
