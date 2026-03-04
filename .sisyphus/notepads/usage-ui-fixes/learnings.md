
## 2026-02-27: Batch Cached Usage Loading Implementation

### Pattern: Batch Loading Cached Data
- Load all cached usage data on Dashboard mount via `api.getAllCachedUsage()`
- Pass cached data through component hierarchy: Dashboard → AccountList → AccountCard
- Use `initialCachedUsage` prop to initialize each card with cached data
- Priority for usage display: `localUsage` (fresh per-card fetch) > `batchUsage` (Query All Usage) > `initialCachedUsage` (cached on mount)

### Anti-Pattern Fixed
- Removed broken `useState(() => { void async () => ... })` hack
- This pattern incorrectly uses useState to trigger async operations on mount
- Correct approach: load data in parent (Dashboard) and pass via props

### Component Architecture
- Removed unused `proxyPort` prop from AccountCard and AccountList
- Props should be cleaned up when no longer needed
- Simplified `handleToggleUsage` to `handleRefreshUsage` - fetches fresh usage without toggle behavior

### API Method Pattern
```typescript
getAllCachedUsage: () =>
  request<Record<string, CachedUsageResponse>>("/accounts/usage/cached")
```
- Reordered complex component layout by targeting correct div boundaries. It's easy to miss a closing tag when replacing large JSX blocks. Using AST tools or precise line ranges avoids syntax errors like `Unexpected end of file before a closing div tag`.
- Relocated Rate Limit Wait and Manual Approve toggles to the right side of the AccountCard header, stacked vertically using flex column layout.\n- Placed toggles before the AccountActions buttons, providing a cleaner, more balanced layout without the separate horizontal row.
