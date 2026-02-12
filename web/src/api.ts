const BASE = "/api"

export interface Account {
  id: string
  name: string
  githubToken: string
  accountType: string
  port: number
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
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ErrorBody
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getAccounts: () => request<Array<Account>>("/accounts"),

  addAccount: (data: {
    name: string
    githubToken: string
    accountType: string
    port: number
  }) =>
    request<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAccount: (id: string, data: Partial<Account>) =>
    request<Account>(`/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteAccount: (id: string) =>
    request<{ ok: boolean }>(`/accounts/${id}`, { method: "DELETE" }),

  startInstance: (id: string) =>
    request<{ status: string }>(`/accounts/${id}/start`, { method: "POST" }),

  stopInstance: (id: string) =>
    request<{ status: string }>(`/accounts/${id}/stop`, { method: "POST" }),

  getUsage: (id: string) => request<UsageData>(`/accounts/${id}/usage`),

  startDeviceCode: () =>
    request<DeviceCodeResponse>("/auth/device-code", { method: "POST" }),

  pollAuth: (sessionId: string) =>
    request<AuthPollResponse>(`/auth/poll/${sessionId}`),

  completeAuth: (data: {
    sessionId: string
    name: string
    accountType: string
    port: number
  }) =>
    request<Account>("/auth/complete", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  checkPort: (port: number, excludeId?: string) =>
    request<{
      available: boolean
      conflict?: string
      accountName?: string
    }>(`/port/check/${port}${excludeId ? `?exclude=${excludeId}` : ""}`),

  suggestPort: (start?: number, excludeId?: string) => {
    const params = new URLSearchParams()
    if (start !== undefined) params.set("start", String(start))
    if (excludeId) params.set("exclude", excludeId)
    const qs = params.toString()
    return request<{ port: number }>(`/port/suggest${qs ? `?${qs}` : ""}`)
  },
}
