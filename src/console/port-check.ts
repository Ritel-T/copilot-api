import { createServer } from "node:net"

import { getAccounts, type Account } from "./account-store"

/**
 * Check if a port is available by attempting to bind to it.
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => {
      server.close(() => resolve(true))
    })
    server.listen(port, "0.0.0.0")
  })
}

export interface PortConflict {
  port: number
  conflict: "account" | "system"
  accountName?: string
}

/**
 * Check a port against existing accounts and system availability.
 * `excludeAccountId` allows skipping the current account when updating.
 */
export async function checkPortConflict(
  port: number,
  excludeAccountId?: string,
): Promise<PortConflict | null> {
  const accounts = await getAccounts()
  const conflicting = accounts.find(
    (a) => a.port === port && a.id !== excludeAccountId,
  )

  if (conflicting) {
    return { port, conflict: "account", accountName: conflicting.name }
  }

  const available = await isPortAvailable(port)
  if (!available) {
    return { port, conflict: "system" }
  }

  return null
}

/**
 * Find the next available port starting from a given port.
 */
export async function findAvailablePort(
  startPort: number,
  excludeAccountId?: string,
): Promise<number> {
  const accounts = await getAccounts()
  const usedPorts = new Set(
    accounts
      .filter((a: Account) => a.id !== excludeAccountId)
      .map((a: Account) => a.port),
  )

  let port = startPort
  while (port <= 65535) {
    if (!usedPorts.has(port)) {
      const available = await isPortAvailable(port)
      if (available) return port
    }
    port++
  }

  throw new Error("No available port found")
}
