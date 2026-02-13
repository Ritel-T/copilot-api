import { useCallback, useEffect, useState } from "react"

import { api, getAdminKey, setAdminKey, type Account } from "./api"
import { AccountCard } from "./components/AccountCard"
import { AddAccountForm } from "./components/AddAccountForm"

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [key, setKey] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    setAdminKey(key.trim())
    try {
      await api.checkAuth()
      onLogin()
    } catch {
      setAdminKey("")
      setError("Invalid admin key")
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
        Enter admin key to continue
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Admin key"
          autoFocus
          style={{ marginBottom: 12 }}
        />
        {error && (
          <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Checking..." : "Login"}
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
        <AccountCard key={account.id} account={account} proxyPort={proxyPort} onRefresh={onRefresh} />
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
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Account"}
        </button>
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
      : <AccountList accounts={accounts} proxyPort={proxyPort} onRefresh={refresh} />}
    </div>
  )
}

export function App() {
  const [authed, setAuthed] = useState(Boolean(getAdminKey()))

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />
  return <Dashboard />
}
