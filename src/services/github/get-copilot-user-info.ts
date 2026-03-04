import { GITHUB_API_BASE_URL, githubHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { state } from "~/lib/state"

export interface CopilotUserInfo {
  copilot_plan:
    | "free"
    | "individual"
    | "individual_pro"
    | "business"
    | "enterprise"
  quota_snapshots?: {
    chat?: { percent_remaining: number }
    completions?: { percent_remaining: number }
  }
  quota_reset_date?: string
  organization_login_list?: Array<string>
}

export const getCopilotUserInfo = async (): Promise<CopilotUserInfo> => {
  const response = await fetch(`${GITHUB_API_BASE_URL}/copilot_internal/user`, {
    headers: githubHeaders(state),
  })

  if (!response.ok) {
    throw new HTTPError("Failed to get Copilot user info", response)
  }

  return (await response.json()) as CopilotUserInfo
}
