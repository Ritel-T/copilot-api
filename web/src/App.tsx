import { useCallback, useEffect, useState } from "react"

import { api, getSessionToken, setSessionToken, type Account, type BatchUsageItem, type PoolConfig } from "./api"
import { AccountCard } from "./components/AccountCard"
import { AddAccountForm } from "./components/AddAccountForm"
import { RequestLogPanel } from "./components/RequestLogPanel"
import { useLocale, useT } from "./i18n"

type AuthState = "loading" | "setup" | "login" | "authed"

function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  return (
    <button
      onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      style={{ fontSize: 13, padding: "4px 10px" }}
    >
      {locale === "en" ? "中文" : "EN"}
    </button>
  )
}

function SetupForm({ onComplete }: { onComplete: () => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const t = useT()

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError(t("passwordMismatch"))
      return
    }
    if (password.length < 6) {
      setError(t("passwordTooShort"))
      return
    }
    setLoading(true)
    try {
      const { token } = await api.setup(username, password)
      setSessionToken(token)
      onComplete()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "120px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>
          {t("consoleTitle")}
        </h1>
        <LanguageSwitcher />
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
        {t("setupSubtitle")}
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("usernamePlaceholder")}
          autoFocus
          autoComplete="username"
          style={{ marginBottom: 12 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          autoComplete="new-password"
          style={{ marginBottom: 12 }}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("confirmPasswordPlaceholder")}
          autoComplete="new-password"
          style={{ marginBottom: 12 }}
        />
        {error && (
          <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button type="submit" className="primary" disabled={loading}>
          {loading ? t("creating") : t("createAdmin")}
        </button>
      </form>
    </div>
  )
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const t = useT()

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { token } = await api.login(username, password)
      setSessionToken(token)
      onLogin()
    } catch {
      setError(t("invalidCredentials"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "120px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>
          {t("consoleTitle")}
        </h1>
        <LanguageSwitcher />
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
        {t("loginSubtitle")}
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("usernamePlaceholder")}
          autoFocus
          autoComplete="username"
          style={{ marginBottom: 12 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordPlaceholder")}
          autoComplete="current-password"
          style={{ marginBottom: 12 }}
        />
        {error && (
          <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button type="submit" className="primary" disabled={loading}>
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>
    </div>
  )
}

function AccountList({
  accounts,
  proxyPort,
  onRefresh,
  batchUsageData,
}: {
  accounts: Array<Account>
  proxyPort: number
  onRefresh: () => Promise<void>
  batchUsageData: Array<BatchUsageItem> | null
}) {
  const t = useT()

  if (accounts.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: 60,
          color: "var(--text-muted)",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius)",
        }}
      >
        <p style={{ fontSize: 16, marginBottom: 8 }}>{t("noAccounts")}</p>
        <p style={{ fontSize: 13 }}>{t("noAccountsHint")}</p>
      </div>
    )
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: 16,
    }}>
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          proxyPort={proxyPort}
          onRefresh={onRefresh}
          batchUsage={batchUsageData?.find(item => item.accountId === account.id)?.usage || null}
        />
      ))}
    </div>
  )
}

function PoolSettings({
  pool,
  proxyPort,
  onChange,
}: {
  pool: PoolConfig
  proxyPort: number
  onChange: (p: PoolConfig) => void
}) {
  const [saving, setSaving] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const t = useT()

  const toggle = async () => {
    setSaving(true)
    try {
      const updated = await api.updatePool({ enabled: !pool.enabled })
      onChange(updated)
    } finally {
      setSaving(false)
    }
  }

  const changeStrategy = async (strategy: PoolConfig["strategy"]) => {
    setSaving(true)
    try {
      const updated = await api.updatePool({ strategy })
      onChange(updated)
    } finally {
      setSaving(false)
    }
  }

  const regenKey = async () => {
    setSaving(true)
    try {
      const updated = await api.regeneratePoolKey()
      onChange(updated)
    } finally {
      setSaving(false)
    }
  }

  const copyKey = () => {
    void navigator.clipboard.writeText(pool.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const maskedKey =
    pool.apiKey?.length > 8
      ? `${pool.apiKey.slice(0, 8)}${"•".repeat(24)}`
      : pool.apiKey ?? ""

  const proxyBase = `${window.location.protocol}//${window.location.hostname}:${proxyPort}`

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
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{t("poolMode")}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {pool.enabled
              ? t("poolEnabledDesc")
              : t("poolDisabledDesc")}
          </div>
        </div>
        <button
          className={pool.enabled ? undefined : "primary"}
          onClick={() => void toggle()}
          disabled={saving}
          style={{ flexShrink: 0 }}
        >
          {pool.enabled ? t("disable") : t("enable")}
        </button>
      </div>
      {pool.enabled && (
        <>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["round-robin", "priority", "quota"] as const).map((s) => (
              <button
                key={s}
                className={pool.strategy === s ? "primary" : undefined}
                onClick={() => void changeStrategy(s)}
                disabled={saving || pool.strategy === s}
                style={{ fontSize: 13 }}
              >
                {s === "round-robin" ? t("roundRobin") : s === "priority" ? t("priority") : t("quota")}
              </button>
            ))}
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                alignSelf: "center",
                marginLeft: 4,
              }}
            >
              {pool.strategy === "round-robin"
                ? t("roundRobinDesc")
                : pool.strategy === "priority"
                  ? t("priorityDesc")
                  : t("quotaDesc")}
            </span>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: "var(--bg)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
              {copied ? t("copied") : t("poolKey")}
            </span>
            <span
              onClick={copyKey}
              style={{
                cursor: "pointer",
                flex: 1,
                color: copied ? "var(--green)" : undefined,
              }}
              title="Click to copy"
            >
              {keyVisible ? pool.apiKey : maskedKey}
            </span>
            <button
              type="button"
              onClick={() => setKeyVisible(!keyVisible)}
              style={{ padding: "2px 8px", fontSize: 11 }}
            >
              {keyVisible ? t("hide") : t("show")}
            </button>
            <button
              type="button"
              onClick={() => void regenKey()}
              disabled={saving}
              style={{ padding: "2px 8px", fontSize: 11 }}
            >
              {t("regen")}
            </button>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "var(--text-muted)",
              fontFamily: "monospace",
            }}
          >
            {t("baseUrl")} {proxyBase} &nbsp;·&nbsp; Bearer {pool.apiKey?.slice(0, 8)}...
          </div>
        </>
      )}
    </div>
  )
}

function usageColor(pct: number): string {
  if (pct > 90) return "var(--red)"
  if (pct > 70) return "var(--yellow)"
  return "var(--green)"
}

function UsageCell({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0
  return (
    <td style={{ padding: "8px 10px", fontSize: 12, fontFamily: "monospace" }}>
      <span style={{ color: usageColor(pct) }}>{used}</span>
      <span style={{ color: "var(--text-muted)" }}> / {total}</span>
    </td>
  )
}


function Dashboard() {
  const [accounts, setAccounts] = useState<Array<Account>>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [proxyPort, setProxyPort] = useState(4141)
  const [pool, setPool] = useState<PoolConfig>({
    enabled: false,
    strategy: "round-robin",
  })
  const [batchUsageData, setBatchUsageData] = useState<Array<BatchUsageItem> | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem("autoRefreshInterval")
    return saved ? parseInt(saved, 10) : 0
  })
  const t = useT()

  const handleQueryAllUsage = async () => {
    setBatchLoading(true)
    try {
      const data = await api.getAllUsage()
      setBatchUsageData(data)
    } catch (err) {
      console.error("Batch usage failed:", err)
    } finally {
      setBatchLoading(false)
    }
  }

  const refresh = useCallback(async () => {
    try {
      const data = await api.getAccounts()
      setAccounts(data)
    } catch (err) {
      console.error("Failed to fetch accounts:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void api.getConfig().then((cfg) => setProxyPort(cfg.proxyPort))
    void api.getPool().then(setPool).catch(() => {})
    void refresh()
    const interval = setInterval(() => void refresh(), 5000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    if (autoRefreshInterval <= 0) return
    const interval = setInterval(() => {
      void handleQueryAllUsage()
    }, autoRefreshInterval * 60 * 1000)
    return () => clearInterval(interval)
  }, [autoRefreshInterval])

  const handleAdd = async () => {
    setShowForm(false)
    await refresh()
  }

  const handleLogout = () => {
    setSessionToken("")
    window.location.reload()
  }

  return (
    <div style={{ padding: "24px 16px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>{t("consoleTitle")}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {t("dashboardSubtitle")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <LanguageSwitcher />
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("autoRefresh")}</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                setAutoRefreshInterval(val)
                localStorage.setItem("autoRefreshInterval", val.toString())
              }}
              style={{ fontSize: 13, padding: "2px 4px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }}
            >
              <option value={0}>{t("off")}</option>
              <option value={1}>1 {t("minutes")}</option>
              <option value={5}>5 {t("minutes")}</option>
              <option value={10}>10 {t("minutes")}</option>
              <option value={30}>30 {t("minutes")}</option>
            </select>
          </div>
          <button onClick={() => void handleQueryAllUsage()} disabled={batchLoading}>
            {batchLoading ? t("refreshing") : t("queryAllUsage")}
          </button>
          <button className="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t("cancel") : t("addAccount")}
          </button>
          <button onClick={handleLogout}>{t("logout")}</button>
        </div>
      </header>
      <PoolSettings pool={pool} proxyPort={proxyPort} onChange={setPool} />

      <RequestLogPanel accounts={accounts} />

      {showForm && (
        <AddAccountForm
          onComplete={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <p
          style={{
            color: "var(--text-muted)",
            textAlign: "center",
            padding: 40,
          }}
        >
          {t("loading")}
        </p>
      ) : (
        <AccountList
          accounts={accounts}
          proxyPort={proxyPort}
          onRefresh={refresh}
          batchUsageData={batchUsageData}
        />
      )}
    </div>
  )
}

export function App() {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const t = useT()

  useEffect(() => {
    void (async () => {
      try {
        const config = await api.getConfig()
        if (config.needsSetup) {
          setAuthState("setup")
          return
        }
        const token = getSessionToken()
        if (token) {
          try {
            await api.checkAuth()
            setAuthState("authed")
            return
          } catch {
            setSessionToken("")
          }
        }
        setAuthState("login")
      } catch {
        setAuthState("login")
      }
    })()
  }, [])

  if (authState === "loading") {
    return (
      <div
        style={{
          color: "var(--text-muted)",
          textAlign: "center",
          padding: 120,
        }}
      >
        {t("loading")}
      </div>
    )
  }

  if (authState === "setup") {
    return <SetupForm onComplete={() => setAuthState("authed")} />
  }

  if (authState === "login") {
    return <LoginForm onLogin={() => setAuthState("authed")} />
  }

  return <Dashboard />
}
