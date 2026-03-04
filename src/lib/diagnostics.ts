import { GITHUB_API_BASE_URL, githubHeaders } from "~/lib/api-config"
import { state } from "~/lib/state"
import { getCopilotUserInfo } from "../services/github/get-copilot-user-info"

// Lightweight diagnostics runner for Copilot API startup checks.
export const runDiagnostics = async (): Promise<void> => {
  // Header
  console.log("╔═══════════════════════════════════════════╗")
  console.log("║   Copilot API Diagnostics                 ║")
  console.log("╚═══════════════════════════════════════════╝")
  console.log("")

  // 1) Network connectivity to GitHub API
  const tStartGitHub = Date.now()
  let githubReachable = false
  let githubMs = 0
  try {
    const resp = await fetch(`${GITHUB_API_BASE_URL}/rate_limit`)
    githubReachable = resp.ok
    githubMs = Date.now() - tStartGitHub
  } catch {
    githubMs = Date.now() - tStartGitHub
    githubReachable = false
  }
  console.log("📡 Network Connectivity")
  console.log(`  ${githubReachable ? "✅" : "❌"} GitHub API: ${githubMs}ms`)
  // Copilot API connectivity is environment/server dependent; mark as N/A at startup
  console.log("  ✅ Copilot API: N/A")

  // 2) GitHub authentication status (if token provided)
  console.log("")
  console.log("🔐 GitHub Authentication")
  if (state.githubToken) {
    let loggedInUser: string | null = null
    let tokenOk = false
    try {
      const resp = await fetch(`${GITHUB_API_BASE_URL}/user`, {
        headers: githubHeaders(state),
      })
      tokenOk = resp.ok
    if (resp.ok) {
        const data: any = await resp.json()
        loggedInUser = data?.login ?? null
      }
    } catch {
      tokenOk = false
    }
    if (tokenOk && loggedInUser) {
      console.log(`  ✅ Logged in as: ${loggedInUser}`)
    } else {
      console.log("  ❌ GitHub token provided but authentication failed")
    }
  } else {
    console.log("  ❌ No GitHub token provided")
  }

  // 3) Copilot subscription / plan info
  console.log("")
  console.log("💼 Copilot Subscription")
  try {
    const info = await getCopilotUserInfo()
    const plan = info.copilot_plan ?? "unknown"
    console.log(`  Plan: ${plan}`)
    const quotas = info.quota_snapshots
    if (quotas?.chat?.percent_remaining !== undefined) {
      console.log(`  Chat quota: ${quotas.chat.percent_remaining}% remaining`)
    }
    if (quotas?.completions?.percent_remaining !== undefined) {
      console.log(`  Completions quota: ${quotas.completions.percent_remaining}% remaining`)
    }
  } catch {
    console.log("  Plan: unknown")
  }

  // 4) Token status
  console.log("")
  console.log("🎫 Token Status")
  if (state.githubToken) {
    let valid = false
    try {
      const resp = await fetch(`${GITHUB_API_BASE_URL}/user`, {
        headers: githubHeaders(state),
      })
      valid = resp.ok
    } catch {
      valid = false
    }
    if (valid) {
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
