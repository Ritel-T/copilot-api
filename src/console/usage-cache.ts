import fs from "node:fs/promises"

import { PATHS } from "~/lib/paths"

interface UsageCacheEntry {
  usage: unknown
  fetchedAt: string
}

interface UsageCache {
  [accountId: string]: UsageCacheEntry
}

async function readCache(): Promise<UsageCache> {
  try {
    const data = await fs.readFile(PATHS.USAGE_CACHE_PATH)
    return JSON.parse(data) as UsageCache
  } catch {
    return {}
  }
}

async function writeCache(cache: UsageCache): Promise<void> {
  await fs.writeFile(PATHS.USAGE_CACHE_PATH, JSON.stringify(cache, null, 2))
}

export async function getCachedUsage(
  accountId: string,
): Promise<{ usage: unknown; fetchedAt: string } | null> {
  const cache = await readCache()
  return cache[accountId] ?? null
}

export async function setCachedUsage(
  accountId: string,
  usage: unknown,
): Promise<void> {
  const cache = await readCache()
  cache[accountId] = {
    usage,
    fetchedAt: new Date().toISOString(),
  }
  await writeCache(cache)
}

export async function getAllCachedUsage(): Promise<
  Record<string, { usage: unknown; fetchedAt: string }>
> {
  return await readCache()
}
