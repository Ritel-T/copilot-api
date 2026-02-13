import { defineCommand } from "citty"
import consola from "consola"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { serve, type ServerHandler } from "srvx"

import { ensurePaths } from "~/lib/paths"

import { getAccountByApiKey, getAccounts } from "./account-store"
import { consoleApi, setAdminKey, setProxyPort } from "./api"
import {
  completionsHandler,
  countTokensHandler,
  embeddingsHandler,
  getInstanceState,
  messagesHandler,
  modelsHandler,
  startInstance,
} from "./instance-manager"

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
}

export const console_ = defineCommand({
  meta: {
    name: "console",
    description: "Start the multi-account management console",
  },
  args: {
    "web-port": {
      alias: "w",
      type: "string",
      default: "3000",
      description: "Port for the web management console",
    },
    "proxy-port": {
      alias: "p",
      type: "string",
      default: "4141",
      description: "Port for the proxy API endpoints",
    },
    "admin-key": {
      type: "string",
      description: "Admin key for console access (auto-generated if not set)",
    },
    verbose: {
      alias: "v",
      type: "boolean",
      default: false,
      description: "Enable verbose logging",
    },
    "auto-start": {
      type: "boolean",
      default: true,
      description: "Auto-start enabled accounts on launch",
    },
  },

  async run({ args }) {
    if (args.verbose) {
      consola.level = 5
    }

    await ensurePaths()

    const webPort = Number.parseInt(args["web-port"], 10)
    const proxyPort = Number.parseInt(args["proxy-port"], 10)
    const adminKeyArg = args["admin-key"] as string | undefined
    const generatedAdminKey =
      adminKeyArg ?? `admin-${crypto.randomBytes(8).toString("hex")}`
    setAdminKey(generatedAdminKey)
    setProxyPort(proxyPort)

    // === Web console server ===
    const webApp = new Hono()
    webApp.use(cors())
    webApp.use(logger())
    webApp.route("/api", consoleApi)
    await mountStaticFiles(webApp)

    // === Proxy server ===
    const proxyApp = new Hono()
    proxyApp.use(cors())
    mountProxyRoutes(proxyApp)

    // Auto-start enabled accounts
    if (args["auto-start"]) {
      await autoStartAccounts()
    }

    serve({ fetch: webApp.fetch as ServerHandler, port: webPort })
    serve({ fetch: proxyApp.fetch as ServerHandler, port: proxyPort })

    consola.box(
      [
        `🎛️  Console:  http://localhost:${webPort}`,
        `🔑 Admin Key: ${generatedAdminKey}`,
        "",
        `Proxy (port ${proxyPort}) — use account API key as Bearer token:`,
        `   OpenAI:    http://localhost:${proxyPort}/v1/chat/completions`,
        `   Anthropic: http://localhost:${proxyPort}/v1/messages`,
        `   Models:    http://localhost:${proxyPort}/v1/models`,
      ].join("\n"),
    )
  },
})

function mountProxyRoutes(app: Hono): void {
  app.post("/chat/completions", proxyAuth, (c) =>
    completionsHandler(c, getState(c)),
  )
  app.post("/v1/chat/completions", proxyAuth, (c) =>
    completionsHandler(c, getState(c)),
  )
  app.get("/models", proxyAuth, (c) => modelsHandler(c, getState(c)))
  app.get("/v1/models", proxyAuth, (c) => modelsHandler(c, getState(c)))
  app.post("/embeddings", proxyAuth, (c) => embeddingsHandler(c, getState(c)))
  app.post("/v1/embeddings", proxyAuth, (c) =>
    embeddingsHandler(c, getState(c)),
  )
  app.post("/v1/messages", proxyAuth, (c) => messagesHandler(c, getState(c)))
  app.post("/v1/messages/count_tokens", proxyAuth, (c) =>
    countTokensHandler(c, getState(c)),
  )
}

async function mountStaticFiles(app: Hono): Promise<void> {
  const webDistPath = path.resolve(
    new URL(".", import.meta.url).pathname,
    "../../web/dist",
  )

  let hasWebDist = false
  try {
    await fs.access(webDistPath)
    hasWebDist = true
  } catch {
    /* no built frontend */
  }

  if (hasWebDist) {
    app.get("/*", async (c) => {
      const reqPath = c.req.path === "/" ? "/index.html" : c.req.path
      const filePath = path.join(webDistPath, reqPath)
      try {
        const content = await fs.readFile(filePath)
        const ext = path.extname(filePath)
        const contentType = MIME_TYPES[ext] ?? "application/octet-stream"
        const cacheControl =
          reqPath.startsWith("/assets/") ?
            "public, max-age=31536000, immutable"
          : "no-cache"
        return c.body(content.buffer as ArrayBuffer, {
          headers: {
            "content-type": contentType,
            "cache-control": cacheControl,
          },
        })
      } catch {
        const indexContent = await fs.readFile(
          path.join(webDistPath, "index.html"),
          "utf8",
        )
        return c.html(indexContent)
      }
    })
  } else {
    app.get("/", (c) =>
      c.text(
        "Console API running. Build the web UI with: cd web && bun install && bun run build",
      ),
    )
  }
}

async function autoStartAccounts(): Promise<void> {
  const accounts = await getAccounts()
  for (const account of accounts) {
    if (account.enabled) {
      try {
        await startInstance(account)
      } catch (error) {
        consola.error(`Failed to auto-start account "${account.name}":`, error)
      }
    }
  }
}

async function proxyAuth(
  c: import("hono").Context,
  next: () => Promise<void>,
): Promise<Response | undefined> {
  const auth = c.req.header("authorization")
  const token = auth?.replace(/^Bearer\s+/i, "")
  if (!token) {
    return c.json({ error: "Missing API key" }, 401)
  }
  const account = await getAccountByApiKey(token)
  if (!account) {
    return c.json({ error: "Invalid API key" }, 401)
  }
  const st = getInstanceState(account.id)
  if (!st) {
    return c.json({ error: "Account instance not running" }, 503)
  }
  c.set("proxyState", st)
  return next()
}

function getState(c: import("hono").Context): import("~/lib/state").State {
  return c.get("proxyState") as import("~/lib/state").State
}
