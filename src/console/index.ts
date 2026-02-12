import { defineCommand } from "citty"
import consola from "consola"
import { Hono } from "hono"
import { cors } from "hono/cors"
import fs from "node:fs/promises"
import path from "node:path"
import { serve, type ServerHandler } from "srvx"

import { ensurePaths } from "~/lib/paths"

import { getAccounts } from "./account-store"
import { consoleApi } from "./api"
import { startInstance } from "./instance-manager"

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
    port: {
      alias: "p",
      type: "string",
      default: "3000",
      description: "Port for the console web UI",
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

    const port = Number.parseInt(args.port, 10)
    const app = new Hono()

    app.use(cors())

    // Mount API routes
    app.route("/api", consoleApi)

    // Serve static frontend
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
          return c.body(content.buffer as ArrayBuffer, {
            headers: {
              "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
            },
          })
        } catch {
          // SPA fallback
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

    // Auto-start enabled accounts
    if (args["auto-start"]) {
      const accounts = await getAccounts()
      for (const account of accounts) {
        if (account.enabled) {
          try {
            await startInstance(account)
          } catch (error) {
            consola.error(
              `Failed to auto-start account "${account.name}":`,
              error,
            )
          }
        }
      }
    }

    serve({
      fetch: app.fetch as ServerHandler,
      port,
    })

    consola.box(`🎛️  Console running at http://localhost:${port}`)
  },
})
