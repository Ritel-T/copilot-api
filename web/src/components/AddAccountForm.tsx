import { useState, useEffect, useRef, useCallback } from "react"

import { api } from "../api"

interface Props {
  onComplete: () => Promise<void>
  onCancel: () => void
}

type Step = "config" | "authorize" | "done"
type PortStatus = "idle" | "checking" | "ok" | "conflict"

function PortIndicator({ status }: { status: PortStatus }) {
  if (status === "idle") return null
  const colorMap: Record<string, string> = {
    ok: "var(--green)",
    conflict: "var(--red)",
    checking: "var(--yellow)",
  }
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        marginLeft: 6,
        verticalAlign: "middle",
        background: colorMap[status] ?? "var(--yellow)",
        ...(status === "checking" ? { animation: "pulse 1.5s infinite" } : {}),
      }}
    />
  )
}

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

function usePortCheck() {
  const [portStatus, setPortStatus] = useState<PortStatus>("idle")
  const [portMessage, setPortMessage] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const check = useCallback((value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const portNum = Number.parseInt(value, 10)
    if (Number.isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      setPortStatus("conflict")
      setPortMessage("Port must be 1024–65535")
      return
    }
    setPortStatus("checking")
    setPortMessage("")
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const result = await api.checkPort(portNum)
          if (result.available) {
            setPortStatus("ok")
            setPortMessage("")
          } else {
            setPortStatus("conflict")
            setPortMessage(
              result.conflict === "account" ?
                `Used by "${result.accountName}"`
              : "Occupied by another process",
            )
          }
        } catch {
          setPortStatus("idle")
        }
      })()
    }, 400)
  }, [])

  return { portStatus, portMessage, check, setPortStatus, setPortMessage }
}

function getPortBorderColor(status: PortStatus): string | undefined {
  if (status === "conflict") return "var(--red)"
  if (status === "ok") return "var(--green)"
  return undefined
}

function PortField({
  port,
  portStatus,
  portMessage,
  onPortChange,
  onAutoPort,
}: {
  port: string
  portStatus: PortStatus
  portMessage: string
  onPortChange: (v: string) => void
  onAutoPort: () => void
}) {
  return (
    <div>
      <label htmlFor="acc-port">
        Port
        <PortIndicator status={portStatus} />
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          id="acc-port"
          type="number"
          value={port}
          onChange={(e) => onPortChange(e.target.value)}
          placeholder="4141"
          style={{ borderColor: getPortBorderColor(portStatus) }}
        />
        <button
          type="button"
          onClick={onAutoPort}
          title="Auto-find available port"
          style={{ flexShrink: 0, padding: "8px 10px", fontSize: 13 }}
        >
          Auto
        </button>
      </div>
      {portMessage && (
        <div style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>
          {portMessage}
        </div>
      )}
    </div>
  )
}

interface ConfigFormProps {
  onSubmit: (e: React.SyntheticEvent) => void
  onCancel: () => void
  loading: boolean
  error: string
  portStatus: PortStatus
  portMessage: string
  name: string
  setName: (v: string) => void
  accountType: string
  setAccountType: (v: string) => void
  port: string
  onPortChange: (v: string) => void
  onAutoPort: () => void
}

function ConfigForm(props: ConfigFormProps) {
  const isDisabled =
    props.loading
    || props.portStatus === "conflict"
    || props.portStatus === "checking"

  return (
    <form onSubmit={props.onSubmit}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
        Add Account
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <label htmlFor="acc-name">Account Name</label>
          <input
            id="acc-name"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="e.g. Personal"
          />
        </div>
        <PortField
          port={props.port}
          portStatus={props.portStatus}
          portMessage={props.portMessage}
          onPortChange={props.onPortChange}
          onAutoPort={props.onAutoPort}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="acc-type">Account Type</label>
        <select
          id="acc-type"
          value={props.accountType}
          onChange={(e) => props.setAccountType(e.target.value)}
        >
          <option value="individual">Individual</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
      {props.error && (
        <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>
          {props.error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={isDisabled}>
          {props.loading ? "Starting..." : "Login with GitHub"}
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

  const startAuth = async (
    name: string,
    accountType: string,
    portNum: number,
  ) => {
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
                port: portNum,
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
  const [port, setPort] = useState("")
  const { portStatus, portMessage, check, setPortStatus, setPortMessage } =
    usePortCheck()
  const auth = useAuthFlow(onComplete)

  useEffect(() => {
    void api.suggestPort(4141).then((res) => {
      setPort(String(res.port))
      setPortStatus("ok")
      setPortMessage("")
    })
  }, [setPortStatus, setPortMessage])

  const handlePortChange = (value: string) => {
    setPort(value)
    check(value)
  }

  const handleAutoPort = () => {
    void (async () => {
      try {
        const res = await api.suggestPort(Number.parseInt(port, 10) || 4141)
        setPort(String(res.port))
        setPortStatus("ok")
        setPortMessage("")
      } catch {
        auth.setError("Failed to find available port")
      }
    })()
  }

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      auth.setError("Account name is required")
      return
    }
    const portNum = Number.parseInt(port, 10)
    if (Number.isNaN(portNum) || portNum < 1024 || portNum > 65535) {
      auth.setError("Port must be between 1024 and 65535")
      return
    }
    if (portStatus === "conflict") {
      auth.setError("Please resolve the port conflict first")
      return
    }
    void auth.startAuth(name.trim(), accountType, portNum)
  }

  if (auth.step === "done") return null

  const wrapperStyle = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 20,
    marginBottom: 16,
  }

  return (
    <div style={wrapperStyle}>
      {auth.step === "config" && (
        <ConfigForm
          onSubmit={handleSubmit}
          onCancel={onCancel}
          loading={auth.loading}
          error={auth.error}
          portStatus={portStatus}
          portMessage={portMessage}
          name={name}
          setName={setName}
          accountType={accountType}
          setAccountType={setAccountType}
          port={port}
          onPortChange={handlePortChange}
          onAutoPort={handleAutoPort}
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
