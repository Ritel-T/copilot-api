import fs from "node:fs/promises"
import path from "node:path"

import { PATHS } from "~/lib/paths"

export interface Account {
  id: string
  name: string
  githubToken: string
  accountType: string
  port: number
  enabled: boolean
  createdAt: string
}

export interface AccountStore {
  accounts: Array<Account>
}

const STORE_PATH = path.join(PATHS.APP_DIR, "accounts.json")

async function readStore(): Promise<AccountStore> {
  try {
    const data = await fs.readFile(STORE_PATH)
    return JSON.parse(data) as AccountStore
  } catch {
    return { accounts: [] }
  }
}

async function writeStore(store: AccountStore): Promise<void> {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2))
}

export async function getAccounts(): Promise<Array<Account>> {
  const store = await readStore()
  return store.accounts
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const store = await readStore()
  return store.accounts.find((a) => a.id === id)
}

export async function addAccount(
  account: Omit<Account, "id" | "createdAt">,
): Promise<Account> {
  const store = await readStore()
  const newAccount: Account = {
    ...account,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  store.accounts.push(newAccount)
  await writeStore(store)
  return newAccount
}

export async function updateAccount(
  id: string,
  updates: Partial<Omit<Account, "id" | "createdAt">>,
): Promise<Account | undefined> {
  const store = await readStore()
  const index = store.accounts.findIndex((a) => a.id === id)
  if (index === -1) return undefined
  store.accounts[index] = { ...store.accounts[index], ...updates }
  await writeStore(store)
  return store.accounts[index]
}

export async function deleteAccount(id: string): Promise<boolean> {
  const store = await readStore()
  const index = store.accounts.findIndex((a) => a.id === id)
  if (index === -1) return false
  store.accounts.splice(index, 1)
  await writeStore(store)
  return true
}
