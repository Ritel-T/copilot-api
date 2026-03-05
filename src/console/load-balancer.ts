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
  quota_remaining?: number
  percent_remaining?: number
}

interface CachedUsage {
  quota_snapshots?: {
    premium_interactions?: QuotaSnapshot
    chat?: QuotaSnapshot
    completions?: QuotaSnapshot
  }
}

/** Calculate remaining quota percentage */
function calcRemaining(snapshot: QuotaSnapshot): number {
  const remaining = snapshot.quota_remaining ?? snapshot.remaining
  const entitlement = snapshot.entitlement
  if (entitlement === 0) return 0
  return remaining / entitlement
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
        // Validate quota_snapshots exists and has all required fields
        if (!q || !q.premium_interactions || !q.chat || !q.completions) {
          return { account, score: -1 } // Incomplete quota data
        }
        // Calculate remaining quota percentage (average of all three quotas)
        // Use quota_remaining if available, otherwise fall back to remaining
        const premiumRemaining = calcRemaining(q.premium_interactions)
        const chatRemaining = calcRemaining(q.chat)
        const compRemaining = calcRemaining(q.completions)
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
