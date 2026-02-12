import { useState } from "react"

import { api, type Account, type UsageData } from "../api"

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    running: "var(--green)",
    stopped: "var(--text-muted)",
    error: "var(--red)",
  }
  const color = colorMap[status] ?? "var(--text-muted)"
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
        }}
      />
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
    <div style={{ marginBottom: 8 }}>
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
        <span>
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
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  )
}

function UsagePanel({ usage }: { usage: UsageData }) {
  const q = usage.quota_snapshots
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        background: "var(--bg)",
        borderRadius: "var(--radius)",
      }}
    >
      <div
        style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}
      >
        Plan: {usage.copilot_plan} · Resets: {usage.quota_reset_date}
      </div>
      <QuotaBar
        label="Premium"
        used={
          q.premium_interactions.entitlement - q.premium_interactions.remaining
        }
        total={q.premium_interactions.entitlement}
      />
      <QuotaBar
        label="Chat"
        used={q.chat.entitlement - q.chat.remaining}
        total={q.chat.entitlement}
      />
      <QuotaBar
        label="Completions"
        used={q.completions.entitlement - q.completions.remaining}
        total={q.completions.entitlement}
      />
    </div>
  )
}

function EndpointsPanel({ port }: { port: number }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 10,
        background: "var(--bg)",
        borderRadius: "var(--radius)",
        fontSize: 12,
        fontFamily: "monospace",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          marginBottom: 4,
          color: "var(--text)",
          fontWeight: 500,
          fontSize: 13,
        }}
      >
        Endpoints
      </div>
      <div>OpenAI: http://localhost:{port}/v1/chat/completions</div>
      <div>Anthropic: http://localhost:{port}/v1/messages</div>
      <div>Models: http://localhost:{port}/v1/models</div>
    </div>
  )
}

function getUsageLabel(loading: boolean, visible: boolean): string {
  if (loading) return "..."
  if (visible) return "Hide Usage"
  return "Usage"
}

interface Props {
  account: Account
  onRefresh: () => Promise<void>
}

function AccountActions({
  account,
  status,
  onRefresh,
}: {
  account: Account
  status: string
  onRefresh: () => Promise<void>
}) {
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleAction = async (action: () => Promise<void>) => {
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
    setActionLoading(true)
    try {
      await api.deleteAccount(account.id)
      await onRefresh()
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setActionLoading(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
      {status === "running" ?
        <button
          onClick={() => void handleAction(() => api.stopInstance(account.id))}
          disabled={actionLoading}
        >
          Stop
        </button>
      : <button
          className="primary"
          onClick={() => void handleAction(() => api.startInstance(account.id))}
          disabled={actionLoading}
        >
          {actionLoading ? "Starting..." : "Start"}
        </button>
      }
      <button
        className="danger"
        onClick={() => void handleDelete()}
        disabled={actionLoading}
      >
        {confirmDelete ? "Confirm?" : "Delete"}
      </button>
    </div>
  )
}

function UsageSection({ accountId }: { accountId: string }) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [showUsage, setShowUsage] = useState(false)

  const handleToggleUsage = async () => {
    if (showUsage) {
      setShowUsage(false)
      return
    }
    setUsageLoading(true)
    try {
      const data = await api.getUsage(accountId)
      setUsage(data)
      setShowUsage(true)
    } catch {
      setUsage(null)
      setShowUsage(true)
    } finally {
      setUsageLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => void handleToggleUsage()} disabled={usageLoading}>
        {getUsageLabel(usageLoading, showUsage)}
      </button>
      {showUsage
        && (usage ?
          <UsagePanel usage={usage} />
        : <div
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            Usage data unavailable. Make sure the instance is running.
          </div>)}
    </>
  )
}

export function AccountCard({ account, onRefresh }: Props) {
  const status = account.status ?? "stopped"

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              {account.name}
            </span>
            <StatusBadge status={status} />
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {account.user?.login ? `@${account.user.login} · ` : ""}
            Port {account.port} · {account.accountType}
          </div>
          {account.error && (
            <div style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>
              Error: {account.error}
            </div>
          )}
        </div>

        <AccountActions
          account={account}
          status={status}
          onRefresh={onRefresh}
        />
      </div>

      {status === "running" && <EndpointsPanel port={account.port} />}
      {status === "running" && <UsageSection accountId={account.id} />}
    </div>
  )
}
