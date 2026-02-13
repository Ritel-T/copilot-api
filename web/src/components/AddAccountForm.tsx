import { useCallback, useEffect, useRef, useState } from "react"

import { api } from "../api"

interface Props {
  onComplete: () => Promise<void>
  onCancel: () => void
}

type Step = "config" | "authorize" | "done"

function DeviceCodeDisplay({
  userCode,
  verificationUri,
}: {
  userCode: string
  verificationUri: string
}) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <p
        style={{
          color: "var(--text-muted)",
          fontSize: 14,
          marginBottom: 16,
        }}
      >
        Enter this code on GitHub:
      </p>
      <div
        onClick={() => void navigator.clipboard.writeText(userCode)}
        style={{
          display: "inline-block",
          padding: "12px 24px",
          background: "var(--bg)",
          border: "2px solid var(--accent)",
          borderRadius: "var(--radius)",
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "monospace",
          letterSpacing: 4,
          cursor: "pointer",
          userSelect: "all",
          marginBottom: 8,
        }}
        title="Click to copy"
      >
        {userCode}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
        Click the code to copy
      </p>
      <a
        href={verificationUri}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "8px 20px",
          background: "var(--accent)",
          color: "#fff",
          borderRadius: "var(--radius)",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        Open GitHub
      </a>
    </div>
  )
}

function AuthorizeStep({
  userCode,
  verificationUri,
  authStatus,
  error,
  onCancel,
}: {
  userCode: string
  verificationUri: string
  authStatus: string
  error: string
  onCancel: () => void
}) {
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
        GitHub Authorization
      </h3>
      <DeviceCodeDisplay
        userCode={userCode}
        verificationUri={verificationUri}
      />
      <p
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 16,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--yellow)",
            animation: "pulse 1.5s infinite",
          }}
        />
        {authStatus}
      </p>
      {error && (
        <div
          style={{
            color: "var(--red)",
            fontSize: 13,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ConfigForm({
  onSubmit,
  onCancel,
  loading,
  error,
  name,
  setName,
  accountType,
  setAccountType,
}: {
  onSubmit: (e: React.SyntheticEvent) => void
  onCancel: () => void
  loading: boolean
  error: string
  name: string
  setName: (v: string) => void
  accountType: string
  setAccountType: (v: string) => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
        Add Account
      </h3>
      <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
        <div>
          <label htmlFor="acc-name">Account Name</label>
          <input
            id="acc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Personal"
          />
        </div>
        <div>
          <label htmlFor="acc-type">Account Type</label>
          <select
            id="acc-type"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
          >
            <option value="individual">Individual</option>
            <option value="business">Business</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>
      {error && (
        <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Starting..." : "Login with GitHub"}
        </button>
      </div>
    </form>
  )
}

function useAuthFlow(onComplete: () => Promise<void>) {
  const [step, setStep] = useState<Step>("config")
  const [userCode, setUserCode] = useState("")
  const [verificationUri, setVerificationUri] = useState("")
  const [authStatus, setAuthStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => cleanup, [cleanup])

  const startAuth = async (name: string, accountType: string) => {
    setError("")
    setLoading(true)
    try {
      const result = await api.startDeviceCode()
      setUserCode(result.userCode)
      setVerificationUri(result.verificationUri)
      setStep("authorize")
      setAuthStatus("Waiting for authorization...")

      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const poll = await api.pollAuth(result.sessionId)
            if (poll.status === "completed") {
              cleanup()
              setAuthStatus("Authorized! Creating account...")
              await api.completeAuth({
                sessionId: result.sessionId,
                name,
                accountType,
              })
              setStep("done")
              await onComplete()
            } else if (poll.status === "expired" || poll.status === "error") {
              cleanup()
              setAuthStatus("")
              setError(poll.error ?? "Authorization failed or expired")
            }
          } catch {
            // poll error, keep trying
          }
        })()
      }, 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return {
    step,
    userCode,
    verificationUri,
    authStatus,
    loading,
    error,
    setError,
    cleanup,
    startAuth,
  }
}

export function AddAccountForm({ onComplete, onCancel }: Props) {
  const [name, setName] = useState("")
  const [accountType, setAccountType] = useState("individual")
  const auth = useAuthFlow(onComplete)

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      auth.setError("Account name is required")
      return
    }
    void auth.startAuth(name.trim(), accountType)
  }

  if (auth.step === "done") return null

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 20,
        marginBottom: 16,
      }}
    >
      {auth.step === "config" && (
        <ConfigForm
          onSubmit={handleSubmit}
          onCancel={onCancel}
          loading={auth.loading}
          error={auth.error}
          name={name}
          setName={setName}
          accountType={accountType}
          setAccountType={setAccountType}
        />
      )}
      {auth.step === "authorize" && (
        <AuthorizeStep
          userCode={auth.userCode}
          verificationUri={auth.verificationUri}
          authStatus={auth.authStatus}
          error={auth.error}
          onCancel={() => {
            auth.cleanup()
            onCancel()
          }}
        />
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
