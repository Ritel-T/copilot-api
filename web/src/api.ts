const BASE = "/api"

let adminKey = ""

export function setAdminKey(key: string): void {
  adminKey = key
}

export function getAdminKey(): string {
  return adminKey
}

export interface Account {
  id: string
  name: string
  githubToken: string
  accountType: string
  apiKey: string
  enabled: boolean
  createdAt: string
  status?: "running" | "stopped" | "error"
  error?: string
  user?: { login: string } | null
}

export interface UsageData {
  copilot_plan: string
  quota_reset_date: string
  quota_snapshots: {
    premium_interactions: QuotaDetail
    chat: QuotaDetail
    completions: QuotaDetail
  }
}

interface QuotaDetail {
  entitlement: number
  remaining: number
  percent_remaining: number
}

export interface DeviceCodeResponse {
  sessionId: string
  userCode: string
  verificationUri: string
  expiresIn: number
}

export interface AuthPollResponse {
  status: "pending" | "completed" | "expired" | "error"
  accessToken?: string
  error?: string
}

interface ErrorBody {
  error?: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  }
  if (adminKey) {
    headers["Authorization"] = `Bearer ${adminKey}`
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  checkAuth: () => request<{ ok: boolean }>("/auth/check"),

  getConfig: () => request<{ proxyPort: number }>("/config"),

  getAccounts: () => request<Array<Account>>("/accounts"),

  deleteAccount: (id: string) =>
    request<{ ok: boolean }>(`/accounts/${id}`, { method: "DELETE" }),

  startInstance: (id: string) =>
    request<{ status: string }>(`/accounts/${id}/start`, { method: "POST" }),

  stopInstance: (id: string) =>
    request<{ status: string }>(`/accounts/${id}/stop`, { method: "POST" }),

  getUsage: (id: string) => request<UsageData>(`/accounts/${id}/usage`),

  regenerateKey: (id: string) =>
    request<Account>(`/accounts/${id}/regenerate-key`, { method: "POST" }),

  startDeviceCode: () =>
    request<DeviceCodeResponse>("/auth/device-code", { method: "POST" }),

  pollAuth: (sessionId: string) =>
    request<AuthPollResponse>(`/auth/poll/${sessionId}`),

  completeAuth: (data: {
    sessionId: string
    name: string
    accountType: string
  }) =>
    request<Account>("/auth/complete", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}
