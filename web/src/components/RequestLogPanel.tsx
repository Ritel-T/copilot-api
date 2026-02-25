import { useState } from "react"

import { api, type LogEntry, type Account } from "../api"
import { useT } from "../i18n"

interface RequestLogPanelProps {
  accounts: Array<Account>
}

export function RequestLogPanel({ accounts }: RequestLogPanelProps) {
  const [logs, setLogs] = useState<Array<LogEntry>>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [accountFilter, setAccountFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const t = useT()

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const data = await api.getLogs({
        account: accountFilter || undefined,
        status:
          statusFilter === "success"
            ? "success"
            : statusFilter === "error"
              ? "error"
              : undefined,
      })
      setLogs(data)
      setFetched(true)
      setOpen(true)
    } catch (err) {
      console.error("Failed to fetch logs:", err)
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString()
    } catch {
      return ts
    }
  }

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
  }

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t("logs")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary" onClick={() => void fetchLogs()} disabled={loading}>
            {loading ? t("refreshing") : t("showLogs")}
          </button>
          {fetched && (
            <button onClick={() => setOpen(!open)}>
              {open ? t("hideLogs") : t("showLogs")}
            </button>
          )}
        </div>
      </div>

      {open && fetched && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {t("filterByAccount")}:
              </label>
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                style={{ width: "auto", minWidth: 120 }}
              >
                <option value="">{t("allAccounts")}</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {t("filterByStatus")}:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: "auto", minWidth: 120 }}
              >
                <option value="">{t("allAccounts")}</option>
                <option value="success">{t("successOnly")}</option>
                <option value="error">{t("errorOnly")}</option>
              </select>
            </div>
            <button onClick={() => void fetchLogs()} disabled={loading}>
              {loading ? "..." : "Apply"}
            </button>
          </div>

          {logs.length === 0 ? (
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: 13,
                padding: 16,
                textAlign: "center",
              }}
            >
              {t("noLogs")}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>{t("colTimestamp")}</th>
                    <th style={thStyle}>{t("colAccount")}</th>
                    <th style={thStyle}>{t("colModel")}</th>
                    <th style={thStyle}>{t("colEndpoint")}</th>
                    <th style={thStyle}>{t("colStatus")}</th>
                    <th style={thStyle}>{t("colLatency")}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr
                      key={`${log.timestamp}-${i}`}
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td style={{ padding: "8px 10px", fontSize: 12, whiteSpace: "nowrap" }}>
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 500 }}>
                        {log.accountName}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, fontFamily: "monospace" }}>
                        {log.model}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-muted)" }}>
                        {log.endpoint}
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12 }}>
                        <span
                          style={{
                            color: log.success ? "var(--green)" : "var(--red)",
                            fontWeight: 500,
                          }}
                        >
                          {log.success ? "OK" : "Error"}
                          {log.statusCode ? ` ${log.statusCode}` : ""}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, fontFamily: "monospace" }}>
                        {log.latencyMs ? `${log.latencyMs}ms` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
