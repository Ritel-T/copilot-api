import { Hono } from "hono"
import { cors } from "hono/cors"
import { z } from "zod"

import {
  getAccounts,
  getAccount,
  addAccount,
  updateAccount,
  deleteAccount,
} from "./account-store"
import { startDeviceFlow, getSession, cleanupSession } from "./auth-flow"
import {
  startInstance,
  stopInstance,
  getInstanceStatus,
  getInstanceError,
  getInstanceUsage,
  getInstanceUser,
} from "./instance-manager"
import { checkPortConflict, findAvailablePort } from "./port-check"

const AddAccountSchema = z.object({
  name: z.string().min(1),
  githubToken: z.string().min(1),
  accountType: z.string().default("individual"),
  port: z.number().int().min(1024).max(65535),
  enabled: z.boolean().default(true),
})

const UpdateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  githubToken: z.string().min(1).optional(),
  accountType: z.string().optional(),
  port: z.number().int().min(1024).max(65535).optional(),
  enabled: z.boolean().optional(),
})

const CompleteAuthSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().min(1),
  accountType: z.string().default("individual"),
  port: z.number().int().min(1024).max(65535),
})

function formatZodError(err: z.ZodError): string {
  return z.treeifyError(err).children ?
      JSON.stringify(z.treeifyError(err))
    : err.message
}

function portConflictMessage(conflict: {
  port: number
  conflict: string
  accountName?: string
}): string {
  return conflict.conflict === "account" ?
      `Port ${conflict.port} is already used by account "${conflict.accountName}"`
    : `Port ${conflict.port} is already in use by another process`
}

export const consoleApi = new Hono()

consoleApi.use(cors())

// List all accounts with status
consoleApi.get("/accounts", async (c) => {
  const accounts = await getAccounts()
  const result = await Promise.all(
    accounts.map(async (account) => {
      const status = getInstanceStatus(account.id)
      const error = getInstanceError(account.id)
      let user: { login: string } | null = null
      if (status === "running") {
        try {
          user = await getInstanceUser(account.id)
        } catch {
          /* ignore */
        }
      }
      return { ...account, status, error, user }
    }),
  )
  return c.json(result)
})

// Get single account
consoleApi.get("/accounts/:id", async (c) => {
  const account = await getAccount(c.req.param("id"))
  if (!account) return c.json({ error: "Account not found" }, 404)
  const status = getInstanceStatus(account.id)
  const error = getInstanceError(account.id)
  return c.json({ ...account, status, error })
})

// Add account
consoleApi.post("/accounts", async (c) => {
  const body: unknown = await c.req.json()
  const parsed = AddAccountSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: formatZodError(parsed.error) }, 400)
  }

  const conflict = await checkPortConflict(parsed.data.port)
  if (conflict) {
    return c.json({ error: portConflictMessage(conflict) }, 409)
  }

  const account = await addAccount(parsed.data)
  return c.json(account, 201)
})

// Update account
consoleApi.put("/accounts/:id", async (c) => {
  const body: unknown = await c.req.json()
  const parsed = UpdateAccountSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: formatZodError(parsed.error) }, 400)
  }

  const id = c.req.param("id")
  if (parsed.data.port !== undefined) {
    const conflict = await checkPortConflict(parsed.data.port, id)
    if (conflict) {
      return c.json({ error: portConflictMessage(conflict) }, 409)
    }
  }

  const account = await updateAccount(id, parsed.data)
  if (!account) return c.json({ error: "Account not found" }, 404)
  return c.json(account)
})

// Delete account
consoleApi.delete("/accounts/:id", async (c) => {
  const id = c.req.param("id")
  await stopInstance(id)
  const deleted = await deleteAccount(id)
  if (!deleted) return c.json({ error: "Account not found" }, 404)
  return c.json({ ok: true })
})

// Start instance
consoleApi.post("/accounts/:id/start", async (c) => {
  const account = await getAccount(c.req.param("id"))
  if (!account) return c.json({ error: "Account not found" }, 404)
  try {
    await startInstance(account)
    return c.json({ status: "running" })
  } catch (error) {
    return c.json({ error: (error as Error).message, status: "error" }, 500)
  }
})

// Stop instance
consoleApi.post("/accounts/:id/stop", async (c) => {
  await stopInstance(c.req.param("id"))
  return c.json({ status: "stopped" })
})

// Get usage for account
consoleApi.get("/accounts/:id/usage", async (c) => {
  const usage = await getInstanceUsage(c.req.param("id"))
  if (!usage)
    return c.json({ error: "Instance not running or usage unavailable" }, 404)
  return c.json(usage)
})

// === Device Code Auth Flow ===

consoleApi.post("/auth/device-code", async (c) => {
  try {
    const result = await startDeviceFlow()
    return c.json(result)
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

consoleApi.get("/auth/poll/:sessionId", (c) => {
  const session = getSession(c.req.param("sessionId"))
  if (!session) return c.json({ error: "Session not found" }, 404)
  return c.json({
    status: session.status,
    accessToken:
      session.status === "completed" ? session.accessToken : undefined,
    error: session.error,
  })
})

consoleApi.post("/auth/complete", async (c) => {
  const body: unknown = await c.req.json()
  const parsed = CompleteAuthSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: formatZodError(parsed.error) }, 400)
  }

  const session = getSession(parsed.data.sessionId)
  if (!session) return c.json({ error: "Session not found" }, 404)
  if (session.status !== "completed" || !session.accessToken) {
    return c.json({ error: "Auth not completed yet" }, 400)
  }

  const conflict = await checkPortConflict(parsed.data.port)
  if (conflict) {
    return c.json({ error: portConflictMessage(conflict) }, 409)
  }

  const account = await addAccount({
    name: parsed.data.name,
    githubToken: session.accessToken,
    accountType: parsed.data.accountType,
    port: parsed.data.port,
    enabled: true,
  })

  cleanupSession(parsed.data.sessionId)
  return c.json(account, 201)
})

// === Port Management ===

consoleApi.get("/port/check/:port", async (c) => {
  const port = Number.parseInt(c.req.param("port"), 10)
  if (Number.isNaN(port) || port < 1024 || port > 65535) {
    return c.json({ error: "Invalid port" }, 400)
  }

  const excludeId = c.req.query("exclude") ?? undefined
  const conflict = await checkPortConflict(port, excludeId)

  if (conflict) {
    return c.json({
      available: false,
      conflict: conflict.conflict,
      accountName: conflict.accountName,
    })
  }

  return c.json({ available: true })
})

consoleApi.get("/port/suggest", async (c) => {
  const startRaw = c.req.query("start") ?? "4141"
  const start = Number.parseInt(startRaw, 10)
  const excludeId = c.req.query("exclude") ?? undefined

  try {
    const port = await findAvailablePort(
      Number.isNaN(start) ? 4141 : start,
      excludeId,
    )
    return c.json({ port })
  } catch {
    return c.json({ error: "No available port found" }, 500)
  }
})
