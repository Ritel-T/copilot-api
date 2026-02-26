import { useState } from "react"

import { api, type Account, type UsageData } from "../api"
import { useT } from "../i18n"

function StatusBadge({ status }: { status: string }) {
  const badgeClassMap: Record<string, string> = {
    running: "badge-green",
    stopped: "badge-neutral",
    error: "badge-red",
  }
  const badgeClass = badgeClassMap[status] ?? "badge-neutral"
  return (
    <span className={`badge ${badgeClass}`}>
      {status}
    </span>
  )
}

function QuotaBar({
  label,
  used,
  total,
}: {
  label: string
  used: number
  total: number
}) {
  const pct = total > 0 ? (used / total) * 100 : 0
  let color = "var(--green)"
  if (pct > 90) color = "var(--red)"
  else if (pct > 70) color = "var(--yellow)"

  return (
    <div style={{ marginBottom: "var(--space-sm)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span className="text-mono">
          {used} / {total} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--border)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(pct, 100)}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
    </div>
  )
}

function UsagePanel({ usage }: { usage: UsageData }) {
  const q = usage.quota_snapshots
  const t = useT()
  return (
    <div
      className="glass-panel"
      style={{
        marginTop: "var(--space-md)",
        padding: "var(--space-md)",
        borderRadius: "var(--radius)",
      }}
    >
      <div
        style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}
      >
        {t("plan")} <span className="text-mono">{usage.copilot_plan}</span> · {t("resets")} <span className="text-mono">{usage.quota_reset_date}</span>
      </div>
      <QuotaBar
        label={t("premium")}
        used={
          q.premium_interactions.entitlement - q.premium_interactions.remaining
        }
        total={q.premium_interactions.entitlement}
      />
      <QuotaBar
        label={t("chat")}
        used={q.chat.entitlement - q.chat.remaining}
        total={q.chat.entitlement}
      />
      <QuotaBar
        label={t("completions")}
        used={q.completions.entitlement - q.completions.remaining}
        total={q.completions.entitlement}
      />
    </div>
  )
}

function useCopyFeedback(): [string | null, (text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }
  return [copied, copy]
}

function ApiKeyPanel({
  apiKey,
  onRegenerate,
}: {
  apiKey: string
  onRegenerate: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [copied, copy] = useCopyFeedback()
  const t = useT()
  const safeKey = apiKey ?? ""
  const masked = safeKey.length > 8 ? `${safeKey.slice(0, 8)}${"•".repeat(24)}` : safeKey
  const isCopied = copied === safeKey

  return (
    <div
      className="glass-panel"
      style={{
        marginTop: "var(--space-md)",
        padding: "var(--space-sm) var(--space-md)",
        borderRadius: "var(--radius)",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
      }}
    >
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
        {isCopied ? t("copied") : t("apiKey")}
      </span>
      <span
        className="text-mono"
        onClick={() => copy(safeKey)}
        style={{
          cursor: "pointer",
          flex: 1,
          color: isCopied ? "var(--green)" : "var(--text)",
        }}
        title="Click to copy"
      >
        {visible ? safeKey : masked}
      </span>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        style={{ padding: "4px 8px", fontSize: 12 }}
      >
        {visible ? t("hide") : t("show")}
      </button>
      <button
        type="button"
        onClick={onRegenerate}
        style={{ padding: "4px 8px", fontSize: 12 }}
      >
        {t("regen")}
      </button>
    </div>
  )
}

interface Props {
  account: Account
  proxyPort: number
  onRefresh: () => Promise<void>
  batchUsage: UsageData | null
}

function AccountActions({
  account,
  status,
  onRefresh,
  onToggleUsage,
  usageLoading,
  showUsage,
}: {
  account: Account
  status: string
  onRefresh: () => Promise<void>
  onToggleUsage: () => void
  usageLoading: boolean
  showUsage: boolean
}) {
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const t = useT()

  const handleAction = async (action: () => Promise<unknown>) => {
    setActionLoading(true)
    try {
      await action()
      await onRefresh()
    } catch (err) {
      console.error("Action failed:", err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    await handleAction(() => api.deleteAccount(account.id))
    setConfirmDelete(false)
  }

  return (
    <div style={{ display: "flex", gap: "var(--space-sm)", flexShrink: 0 }}>
      {status === "running" && (
        <button onClick={onToggleUsage} disabled={usageLoading}>
          {usageLoading ? "..." : showUsage ? t("hideUsage") : t("usage")}
        </button>
      )}
      {status === "running" ?
        <button
          onClick={() => void handleAction(() => api.stopInstance(account.id))}
          disabled={actionLoading}
        >
          {t("stop")}
        </button>
      : <button
          className="primary"
          onClick={() => void handleAction(() => api.startInstance(account.id))}
          disabled={actionLoading}
        >
          {actionLoading ? t("starting") : t("start")}
        </button>
      }
      <button
        className="danger"
        onClick={() => void handleDelete()}
        disabled={actionLoading}
      >
        {confirmDelete ? t("confirmDelete") : t("delete")}
      </button>
    </div>
  )
}

export function AccountCard({ account, proxyPort, onRefresh, batchUsage }: Props) {
  const status = account.status ?? "stopped"
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [showUsage, setShowUsage] = useState(false)
  const [editingPriority, setEditingPriority] = useState(false)
  const [priorityValue, setPriorityValue] = useState(
    String(account.priority ?? 0),
  )
  const [cachedUsage, setCachedUsage] = useState<{
    usage: UsageData
    fetchedAt: string
  } | null>(null)
  const t = useT()

  // Load cached usage on mount
  useState(() => {
    void (async () => {
      try {
        const cached = await api.getCachedUsage(account.id)
        setCachedUsage(cached)
      } catch {
        // No cached data
      }
    })()
  })

  const handleToggleUsage = async () => {
    if (showUsage) {
      setShowUsage(false)
      return
    }
    setUsageLoading(true)
    try {
      const data = await api.getUsage(account.id)
      setUsage(data)
      setShowUsage(true)
      // Update cached usage
      setCachedUsage({
        usage: data,
        fetchedAt: new Date().toISOString(),
      })
    } catch {
      setUsage(null)
      setShowUsage(true)
    } finally {
      setUsageLoading(false)
    }
  }

  const handleRegenerate = () => {
    void (async () => {
      try {
        await api.regenerateKey(account.id)
        await onRefresh()
      } catch (err) {
        console.error("Regenerate failed:", err)
      }
    })()
  }

  const handlePrioritySave = () => {
    const num = parseInt(priorityValue, 10)
    if (isNaN(num) || num < 0) {
      setPriorityValue(String(account.priority ?? 0))
      setEditingPriority(false)
      return
    }
    setEditingPriority(false)
    if (num !== (account.priority ?? 0)) {
      void (async () => {
        try {
          await api.updateAccount(account.id, { priority: num })
          await onRefresh()
        } catch (err) {
          console.error("Priority update failed:", err)
          setPriorityValue(String(account.priority ?? 0))
        }
      })()
    }
  }

  const handleToggle = (field: "rateLimitWait" | "manualApprove", value: boolean) => {
    void (async () => {
      try {
        await api.updateAccount(account.id, { [field]: value })
        await onRefresh()
      } catch (err) {
        console.error(`${field} update failed:`, err)
      }
    })()
  }

  // Format last query time
  const formatLastQuery = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  return (
    <div className="card animate-fade-in">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-md)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-md)",
              marginBottom: "var(--space-xs)",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              {account.name}
            </h3>
            <StatusBadge status={status} />
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            {account.user?.login ? <span className="badge badge-neutral text-mono">@{account.user.login}</span> : null}
            <span className="badge badge-neutral text-mono">{account.accountType}</span>
          </div>
          {account.error && (
            <div style={{ fontSize: 12, color: "var(--red)", marginTop: "var(--space-sm)" }}>
              {t("error")} {account.error}
            </div>
          )}
        </div>

        <AccountActions
          account={account}
          status={status}
          onRefresh={onRefresh}
          onToggleUsage={() => void handleToggleUsage()}
          usageLoading={usageLoading}
          showUsage={showUsage}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          fontSize: 13,
          marginBottom: "var(--space-md)",
        }}
      >
        <span style={{ color: "var(--text-muted)" }}>{t("priorityLabel")}</span>
        {editingPriority ? (
          <input
            type="number"
            value={priorityValue}
            onChange={(e) => setPriorityValue(e.target.value)}
            onBlur={handlePrioritySave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePrioritySave()
              if (e.key === "Escape") {
                setPriorityValue(String(account.priority ?? 0))
                setEditingPriority(false)
              }
            }}
            autoFocus
            min={0}
            style={{
              width: 60,
              padding: "4px 8px",
              fontSize: 13,
            }}
          />
        ) : (
          <span
            className="badge badge-neutral text-mono"
            onClick={() => setEditingPriority(true)}
            style={{ cursor: "pointer" }}
            title="Click to edit"
          >
            {account.priority ?? 0}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {t("priorityHint")}
        </span>
      </div>

      {/* Settings toggles */}
      <div
        style={{
          display: "flex",
          gap: "var(--space-lg)",
          fontSize: 13,
          marginBottom: "var(--space-md)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            cursor: "pointer",
            margin: 0,
          }}
        >
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={account.rateLimitWait ?? false}
              onChange={(e) => handleToggle("rateLimitWait", e.target.checked)}
            />
            <span className="toggle-slider" />
          </span>
          <span style={{ color: "var(--text-muted)", marginTop: 0 }}>Rate Limit Wait</span>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            cursor: "pointer",
            margin: 0,
          }}
        >
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={account.manualApprove ?? false}
              onChange={(e) => handleToggle("manualApprove", e.target.checked)}
            />
            <span className="toggle-slider" />
          </span>
          <span style={{ color: "var(--text-muted)", marginTop: 0 }}>Manual Approve</span>
        </label>
      </div>

      <ApiKeyPanel apiKey={account.apiKey} onRegenerate={handleRegenerate} />

      {/* Quota / Usage display */}
      {(batchUsage || cachedUsage) && (
        <div
          className="glass-panel"
          style={{
            marginTop: "var(--space-md)",
            padding: "var(--space-md)",
            borderRadius: "var(--radius)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: "var(--space-sm)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{t("plan")} <span className="text-mono">{(batchUsage || cachedUsage!.usage).copilot_plan}</span></span>
            {batchUsage ? (
              <span className="badge badge-green">Live Usage</span>
            ) : (
              <span className="text-mono">Last query: {formatLastQuery(cachedUsage!.fetchedAt)}</span>
            )}
          </div>
          <UsagePanel usage={batchUsage || cachedUsage!.usage} />
        </div>
      )}
      
      {showUsage && !batchUsage && (usage ? <UsagePanel usage={usage} /> : <div style={{ marginTop: "var(--space-md)", fontSize: 13, color: "var(--text-muted)" }}>{t("usageUnavailable")}</div>)}
    </div>
  )
}
