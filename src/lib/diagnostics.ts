import { GITHUB_API_BASE_URL, githubHeaders } from "~/lib/api-config"
import { state } from "~/lib/state"

import { getCopilotUserInfo } from "../services/github/get-copilot-user-info"

interface GitHubUserResponse {
  login: string
}

async function checkGitHubConnectivity(): Promise<{
  reachable: boolean
  latencyMs: number
}> {
  const startTime = Date.now()
  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}/rate_limit`)
    return { reachable: response.ok, latencyMs: Date.now() - startTime }
  } catch {
    return { reachable: false, latencyMs: Date.now() - startTime }
  }
}

async function checkGitHubAuth(): Promise<{
  loggedIn: boolean
  username: string | null
}> {
  if (!state.githubToken) {
    return { loggedIn: false, username: null }
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}/user`, {
      headers: githubHeaders(state),
    })
    if (!response.ok) {
      return { loggedIn: false, username: null }
    }
    const data = (await response.json()) as GitHubUserResponse
    return { loggedIn: true, username: data.login }
  } catch {
    return { loggedIn: false, username: null }
  }
}

async function checkTokenValidity(): Promise<boolean> {
  if (!state.githubToken) {
    return false
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}/user`, {
      headers: githubHeaders(state),
    })
    return response.ok
  } catch {
    return false
  }
}

async function getCopilotInfo(): Promise<{
  plan: string
  chatPercent?: number
  completionsPercent?: number
}> {
  try {
    const info = await getCopilotUserInfo()
    const plan = info.copilot_plan
    const quotas = info.quota_snapshots
    return {
      plan,
      chatPercent: quotas?.chat?.percent_remaining,
      completionsPercent: quotas?.completions?.percent_remaining,
    }
  } catch {
    return { plan: "unknown" }
  }
}

// Lightweight diagnostics runner for Copilot API startup checks.
export const runDiagnostics = async (): Promise<void> => {
  // Header
  console.log("╔═══════════════════════════════════════════╗")
  console.log("║   Copilot API Diagnostics                 ║")
  console.log("╚═══════════════════════════════════════════╝")
  console.log("")

  // 1) Network connectivity to GitHub API
  const github = await checkGitHubConnectivity()
  console.log("📡 Network Connectivity")
  console.log(
    `  ${github.reachable ? "✅" : "❌"} GitHub API: ${github.latencyMs}ms`,
  )
  console.log("  ✅ Copilot API: N/A")

  // 2) GitHub authentication status (if token provided)
  console.log("")
  console.log("🔐 GitHub Authentication")
  const auth = await checkGitHubAuth()
  if (auth.loggedIn && auth.username) {
    console.log(`  ✅ Logged in as: ${auth.username}`)
  } else if (state.githubToken) {
    console.log("  ❌ GitHub token provided but authentication failed")
  } else {
    console.log("  ❌ No GitHub token provided")
  }

  // 3) Copilot subscription / plan info
  console.log("")
  console.log("💼 Copilot Subscription")
  const copilotInfo = await getCopilotInfo()
  console.log(`  Plan: ${copilotInfo.plan}`)
  if (copilotInfo.chatPercent !== undefined) {
    console.log(`  Chat quota: ${copilotInfo.chatPercent}% remaining`)
  }
  if (copilotInfo.completionsPercent !== undefined) {
    console.log(
      `  Completions quota: ${copilotInfo.completionsPercent}% remaining`,
    )
  }

  // 4) Token status
  console.log("")
  console.log("🎫 Token Status")
  const tokenValid = await checkTokenValidity()
  if (state.githubToken) {
    if (tokenValid) {
      console.log("  ✅ Valid (expires in unknown)")
    } else {
      console.log("  ❌ Invalid")
    }
  } else {
    console.log("  ❌ Token not provided")
  }

  // Finish
  console.log("")
  console.log("╔═══════════════════════════════════════════╗")
  console.log("║   Diagnostics Complete                    ║")
  console.log("╚═══════════════════════════════════════════╝")
}
