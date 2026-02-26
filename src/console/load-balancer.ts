import { type Account, getAccounts } from "./account-store"
import { getInstanceState } from "./instance-manager"

let rrIndex = 0

export function getRunningAccounts(accounts: Array<Account>): Array<Account> {
  return accounts.filter(
    (a) => a.enabled && getInstanceState(a.id) !== undefined,
  )
}

interface QuotaSnapshot {
  entitlement: number
  remaining: number
}

interface CachedUsage {
  quota_snapshots: {
    premium_interactions: QuotaSnapshot
    chat: QuotaSnapshot
    completions: QuotaSnapshot
  }
}

export async function selectAccount(
  strategy: "round-robin" | "priority" | "quota",
  exclude?: Set<string>,
): Promise<{ account: Account; state: import("~/lib/state").State } | null> {
  const all = await getAccounts()
  let running = getRunningAccounts(all)

  if (exclude?.size) {
    running = running.filter((a) => !exclude.has(a.id))
  }

  if (running.length === 0) return null

  let selected: Account

  if (strategy === "priority") {
    running.sort((a, b) => b.priority - a.priority)
    selected = running[0]
  } else if (strategy === "quota") {
    // Select account with most remaining quota
    // Use cached usage data if available, otherwise fall back to round-robin
    const { getCachedUsage } = await import("./usage-cache")
    const accountsWithQuota = await Promise.all(
      running.map(async (account) => {
        const cached = (await getCachedUsage(account.id)) as {
          usage: CachedUsage
          fetchedAt: string
        } | null
        if (!cached?.usage) {
          return { account, score: -1 } // No quota data, lowest priority
        }
        const q = cached.usage.quota_snapshots
        // Calculate remaining quota percentage (average of all three quotas)
        const premiumRemaining =
          q.premium_interactions.remaining / q.premium_interactions.entitlement
        const chatRemaining = q.chat.remaining / q.chat.entitlement
        const compRemaining =
          q.completions.remaining / q.completions.entitlement
        const avgRemaining =
          (premiumRemaining + chatRemaining + compRemaining) / 3
        return { account, score: avgRemaining }
      }),
    )
    // Sort by score descending (highest remaining quota first)
    accountsWithQuota.sort((a, b) => b.score - a.score)
    // If all accounts have no quota data, fall back to round-robin
    if (accountsWithQuota[0].score < 0) {
      rrIndex = rrIndex % running.length
      selected = running[rrIndex]
      rrIndex = (rrIndex + 1) % running.length
    } else {
      selected = accountsWithQuota[0].account
    }
  } else {
    // round-robin
    rrIndex = rrIndex % running.length
    selected = running[rrIndex]
    rrIndex = (rrIndex + 1) % running.length
  }

  const state = getInstanceState(selected.id)
  if (!state) return null

  return { account: selected, state }
}
