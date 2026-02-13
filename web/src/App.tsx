import { useCallback, useEffect, useState } from "react"

import { api, getSessionToken, setSessionToken, type Account } from "./api"
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

function Dashboard() {
  const [accounts, setAccounts] = useState<Array<Account>>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [proxyPort, setProxyPort] = useState(4141)

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
