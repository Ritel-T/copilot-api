import { useCallback, useEffect, useState } from "react"

import { api, getSessionToken, setSessionToken, type Account, type PoolConfig } from "./api"
import { AccountCard } from "./components/AccountCard"
import { AddAccountForm } from "./components/AddAccountForm"

type AuthState = "loading" | "setup" | "login" | "authed"

function SetupForm({ onComplete }: { onComplete: () => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
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
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
        Copilot API Console
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
        Create your admin account to get started
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
          autoComplete="username"
          style={{ marginBottom: 12 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          autoComplete="new-password"
          style={{ marginBottom: 12 }}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          autoComplete="new-password"
          style={{ marginBottom: 12 }}
        />
        {error && (
          <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Creating..." : "Create Admin Account"}
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

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { token } = await api.login(username, password)
      setSessionToken(token)
      onLogin()
    } catch {
      setError("Invalid username or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "120px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
        Copilot API Console
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
        Sign in to continue
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
          autoComplete="username"
          style={{ marginBottom: 12 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          style={{ marginBottom: 12 }}
        />
        {error && (
          <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  )
}

function AccountList({
  accounts,
  proxyPort,
  onRefresh,
}: {
  accounts: Array<Account>
  proxyPort: number
  onRefresh: () => Promise<void>
}) {
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
        <p style={{ fontSize: 16, marginBottom: 8 }}>No accounts configured</p>
        <p style={{ fontSize: 13 }}>Add a GitHub account to get started</p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          proxyPort={proxyPort}
          onRefresh={onRefresh}
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
          <div style={{ fontSize: 15, fontWeight: 600 }}>Pool Mode</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {pool.enabled
              ? "Requests with pool key are load-balanced across running accounts"
              : "Enable to auto-distribute requests across accounts"}
          </div>
        </div>
        <button
          className={pool.enabled ? undefined : "primary"}
          onClick={() => void toggle()}
          disabled={saving}
          style={{ flexShrink: 0 }}
        >
          {pool.enabled ? "Disable" : "Enable"}
        </button>
      </div>
      {pool.enabled && (
        <>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            {(["round-robin", "priority"] as const).map((s) => (
              <button
                key={s}
                className={pool.strategy === s ? "primary" : undefined}
                onClick={() => void changeStrategy(s)}
                disabled={saving || pool.strategy === s}
                style={{ fontSize: 13 }}
              >
                {s === "round-robin" ? "Round Robin" : "Priority"}
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
                ? "Evenly distribute across accounts"
                : "Prefer higher-priority accounts first"}
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
              {copied ? "Copied!" : "Pool Key:"}
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
              {keyVisible ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={() => void regenKey()}
              disabled={saving}
              style={{ padding: "2px 8px", fontSize: 11 }}
            >
              Regen
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
            Base URL: {proxyBase} &nbsp;·&nbsp; Bearer {pool.apiKey?.slice(0, 8)}...
          </div>
        </>
      )}
    </div>
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

  const handleAdd = async () => {
    setShowForm(false)
    await refresh()
  }

  const handleLogout = () => {
    setSessionToken("")
    window.location.reload()
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Copilot API Console</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Manage multiple GitHub Copilot proxy accounts
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Account"}
          </button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <PoolSettings pool={pool} proxyPort={proxyPort} onChange={setPool} />

      {showForm && (
        <AddAccountForm
          onComplete={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ?
        <p
          style={{
            color: "var(--text-muted)",
            textAlign: "center",
            padding: 40,
          }}
        >
          Loading...
        </p>
      : <AccountList
          accounts={accounts}
          proxyPort={proxyPort}
          onRefresh={refresh}
        />
      }
    </div>
  )
}

export function App() {
  const [authState, setAuthState] = useState<AuthState>("loading")

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
        Loading...
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
