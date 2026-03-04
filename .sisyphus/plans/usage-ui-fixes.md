# Usage UI Fixes and Card Layout Polish

## TL;DR

> **Quick Summary**: Fix 4 WebUI issues: usage persistence on page refresh, unify per-card usage button with batch query, reduce API key masking width, and rearrange toggle layout on account cards.
>
> **Deliverables**:
> - Backend route `/accounts/usage/cached` for batch cached usage
> - Frontend batch cached usage loading on page init
> - Unified usage query logic (per-card refresh = same as batch, but single account)
> - Reduced API key masking (8 dots instead of 24)
> - Toggle layout restructured to right side of card header
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves (Task A+B dependent, C+D independent)
> **Critical Path**: Task 1 → Task 2 (backend enables frontend)

---

## Context

### Original Request
User reported 4 issues:
1. "刷新页面后，用量数据消失，需手动再次查询" — usage data disappears after page refresh
2. "每个账号卡片上的'用量'按钮成为无用按钮" — per-card usage button is broken/useless
3. "API密钥显示太多掩码符号" — API key masking too wide
4. "Rate Limit Wait 和 Manual Approve 开关布局需调整" — toggle layout needs restructure

### Interview Summary
**Key Discussions**:
- Usage persistence: Batch-load all cached usage on page init (not per-card)
- Per-card usage button: Refactor so "Query All Usage" = clicking all per-card refresh buttons (unified logic)
- API key masking: 前8明文 + 8个• (8 visible + 8 dots, AccountCard only)
- Toggle layout: Right side of top row, stacked vertically (3-column layout)

### Metis Review
**Identified Gaps** (addressed):
- PoolSettings also has `"•".repeat(24)` — DECISION: Only change AccountCard, leave PoolSettings unchanged
- Toggle exact positioning — DECISION: Right of top row, creating 3-column layout
- Usage data priority after refresh — DECISION: Unified logic, no priority conflict

---

## Work Objectives

### Core Objective
Polish the AccountCard component with 4 fixes: usage persistence, unified query logic, reduced masking, improved toggle layout.

### Concrete Deliverables
- `src/console/api.ts`: New route `GET /accounts/usage/cached`
- `web/src/api.ts`: New method `getAllCachedUsage()`
- `web/src/App.tsx`: Load cached usage on mount, pass to AccountList
- `web/src/components/AccountCard.tsx`: Fixed usage logic, reduced masking, restructured toggle layout

### Definition of Done
- [x] Page refresh shows cached usage immediately (no "用量数据不可用")
- [x] Per-card "用量" button fetches fresh usage for that card
- [x] API key displays 8 dots instead of 24
- [x] Toggles stacked vertically on right side of card header
- [x] `cd web && bun run build` passes
- [x] `bun run lint` passes
- [ ] Page refresh shows cached usage immediately (no "用量数据不可用")
- [ ] Per-card "用量" button fetches fresh usage for that card
- [ ] API key displays 8 dots instead of 24
- [ ] Toggles stacked vertically on right side of card header
- [ ] `cd web && bun run build` passes
- [ ] `bun run lint` passes

### Must Have
- Usage persistence on page refresh
- Per-card refresh button works
- API key masking reduced to 8 dots
- Toggle layout moved to right side

### Must NOT Have (Guardrails)
- DO NOT change PoolSettings API key masking (App.tsx line 270)
- DO NOT modify existing `/accounts/:id/usage/cached` single-account route
- DO NOT modify the 5-second polling interval in Dashboard
- DO NOT add auto-refresh polling for per-card usage
- DO NOT change toggle onChange handlers or labels

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **Automated tests**: NO — these are UI/frontend changes, verified via Playwright QA scenarios
- **Framework**: bun test (for any unit tests if needed)
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Backend + Frontend Core):
├── Task 1: Add backend route /accounts/usage/cached [quick]
└── Task 3: Reduce API key masking in AccountCard [quick]

Wave 2 (After Wave 1):
├── Task 2: Frontend batch cached usage + unified query logic [unspecified-high]
└── Task 4: Restructure toggle layout [visual-engineering]

Wave FINAL (After ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Build & lint verification (quick)
├── Task F3: Real manual QA with Playwright (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 2 (backend enables frontend)
Parallel Speedup: Task 1+3 can run in parallel, Task 2+4 can run in parallel after Wave 1
```

### Dependency Matrix
- **1**: — — 2 (backend route needed before frontend can call it)
- **2**: 1 — F1-F4
- **3**: — — F1-F4
- **4**: — — F1-F4

### Agent Dispatch Summary
- **Wave 1**: 2 tasks — T1 → `quick`, T3 → `quick`
- **Wave 2**: 2 tasks — T2 → `unspecified-high`, T4 → `visual-engineering`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `quick`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. **Add backend route `/accounts/usage/cached`**

  **What to do**:
  - Add a new GET route `/accounts/usage/cached` in `src/console/api.ts`
  - Import and call `getAllCachedUsage()` from `usage-cache.ts`
  - Return the result as JSON: `Record<string, { usage: UsageData; fetchedAt: string }>`
  - Follow the same Hono pattern as existing routes (see line 127-155 for reference)

  **Must NOT do**:
  - DO NOT modify existing `/accounts/:id/usage/cached` single-account route
  - DO NOT change `getAllCachedUsage()` function in usage-cache.ts
  - DO NOT add authentication/authorization changes (reuse existing middleware)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple route addition, follows existing patterns exactly
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Task 2 (frontend needs this route)
  - **Blocked By**: None

  **References**:
  - `src/console/api.ts:127-155` — Existing `/accounts/usage` batch route pattern to follow
  - `src/console/api.ts:253-261` — Existing `/accounts/:id/usage/cached` single route
  - `src/console/usage-cache.ts:46-50` — `getAllCachedUsage()` function to call
  - `src/console/usage-cache.ts:5-12` — `UsageCache` interface for response type

  **Acceptance Criteria**:
  - [ ] Route `GET /accounts/usage/cached` exists in api.ts
  - [ ] Route returns `{ [accountId]: { usage, fetchedAt } }` JSON
  - [ ] Route handles empty cache gracefully (returns `{}`)

  **QA Scenarios**:
  ```
  Scenario: Backend route returns cached usage data
    Tool: Bash (curl)
    Preconditions: Server running on port 4141, at least one account has cached usage
    Steps:
      1. curl -s http://localhost:4141/api/accounts/usage/cached | jq 'keys | length'
      2. Assert output is a number >= 0
    Expected Result: JSON object with account IDs as keys
    Evidence: .sisyphus/evidence/task-1-backend-route.txt

  Scenario: Backend route handles empty cache
    Tool: Bash (curl)
    Preconditions: Server running, usage cache file empty or missing
    Steps:
      1. curl -s http://localhost:4141/api/accounts/usage/cached | jq '.'
      2. Assert output is `{}`
    Expected Result: Empty object returned gracefully
    Evidence: .sisyphus/evidence/task-1-empty-cache.txt
  ```

  **Commit**: NO (group with all tasks)

- [x] 2. **Frontend batch cached usage + unified query logic**

  **What to do**:
  - Add `getAllCachedUsage()` method to `web/src/api.ts` calling `/accounts/usage/cached`
  - In `Dashboard` component (`App.tsx`):
    - Add `cachedUsageData` state: `Record<string, CachedUsageResponse>`
    - On mount (useEffect), call `api.getAllCachedUsage()` and store in state
    - Pass `cachedUsageData` to `AccountList` as new prop
  - In `AccountList` component:
    - Add `cachedUsageData` prop
    - Pass each account's cached usage to `AccountCard`
  - In `AccountCard` component:
    - Remove the broken `useState` hack at lines 276-286
    - Remove `usage`, `usageLoading`, `showUsage`, `cachedUsage` local states
    - Add `localUsage` state for per-card refresh result
    - Change per-card "用量" button to call `api.getUsage(account.id)`, store in `localUsage`
    - Update usage display priority: `localUsage` > `batchUsage` > `initialCachedUsage`
    - The "Query All Usage" button in Dashboard already calls `api.getAllUsage()` — keep as-is

  **Must NOT do**:
  - DO NOT change the 5-second polling interval in Dashboard
  - DO NOT remove the "Query All Usage" button
  - DO NOT add auto-refresh polling for per-card usage
  - DO NOT call `getAllCachedUsage()` in the polling interval (only on mount)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple file changes, state management refactor, requires careful integration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1-F4
  - **Blocked By**: Task 1 (needs backend route)

  **References**:
  - `web/src/App.tsx:406-433` — Dashboard state and `handleQueryAllUsage`
  - `web/src/App.tsx:550-555` — AccountList props to extend
  - `web/src/components/AccountCard.tsx:180-185` — Props interface to extend
  - `web/src/components/AccountCard.tsx:270-286` — Broken useState hack to remove
  - `web/src/components/AccountCard.tsx:288-309` — handleToggleUsage to refactor
  - `web/src/components/AccountCard.tsx:500-537` — Usage display logic to update
  - `web/src/api.ts:156-159` — Existing usage API methods

  **Acceptance Criteria**:
  - [ ] `api.getAllCachedUsage()` method exists in api.ts
  - [ ] Dashboard loads cached usage on mount
  - [ ] Cached usage displays immediately on page load (no "用量数据不可用")
  - [ ] Per-card "用量" button fetches fresh usage and displays it
  - [ ] Removed broken useState hack and dead state variables

  **QA Scenarios**:
  ```
  Scenario: Page shows cached usage on load
    Tool: Playwright
    Preconditions: Server running, at least one account with cached usage data
    Steps:
      1. Navigate to http://localhost:4141/
      2. Wait for account cards to load
      3. Assert at least one card shows "Cached:" timestamp in usage panel
      4. Assert no card shows "用量数据不可用" if cache exists
    Expected Result: Cached usage visible immediately without clicking any button
    Evidence: .sisyphus/evidence/task-2-cached-on-load.png

  Scenario: Per-card refresh button works
    Tool: Playwright
    Preconditions: Server running, at least one account in "running" status
    Steps:
      1. Navigate to http://localhost:4141/
      2. Find a card with status "running"
      3. Click the "用量" button on that card
      4. Wait for loading to complete
      5. Assert card shows updated usage data
    Expected Result: Single card usage refreshed, others unchanged
    Evidence: .sisyphus/evidence/task-2-per-card-refresh.png
  ```

  **Commit**: NO (group with all tasks)

- [x] 3. **Reduce API key masking in AccountCard**

  **What to do**:
  - In `web/src/components/AccountCard.tsx` line 131
  - Change `"•".repeat(24)` to `"•".repeat(8)`
  - Keep the prefix `slice(0, 8)` unchanged

  **Must NOT do**:
  - DO NOT change PoolSettings masking in App.tsx line 270
  - DO NOT change the visible prefix length (keep 8 chars)
  - DO NOT modify any other masking logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line change, trivial
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: F1-F4
  - **Blocked By**: None

  **References**:
  - `web/src/components/AccountCard.tsx:131` — Exact line to change

  **Acceptance Criteria**:
  - [ ] API key displays 8 dots instead of 24
  - [ ] Total displayed length is ~16 chars (8 visible + 8 dots)
  - [ ] PoolSettings in App.tsx unchanged (still 24 dots)

  **QA Scenarios**:
  ```
  Scenario: API key shows 8 dots
    Tool: Playwright
    Preconditions: Server running, at least one account with API key
    Steps:
      1. Navigate to http://localhost:4141/
      2. Find an account card
      3. Click "show" on API key panel
      4. Assert masked key shows 8 visible chars + 8 dots
    Expected Result: Masked key is ~16 chars total
    Evidence: .sisyphus/evidence/task-3-masking.png
  ```

  **Commit**: NO (group with all tasks)

- [x] 4. **Restructure toggle layout**

  **What to do**:
  - Move Rate Limit Wait and Manual Approve toggles to the right side of the card header row
  - Create a 3-column layout in the top row: `[name+status] [toggles] [action buttons]`
  - Toggles stacked vertically (column flex)
  - Remove the horizontal toggle row at lines 451-498
  - Adjust left-side elements (username, badges, priority) for visual balance

  **Must NOT do**:
  - DO NOT change toggle onChange handlers
  - DO NOT change toggle labels ("Rate Limit Wait", "Manual Approve")
  - DO NOT move AccountActions buttons (stop/start/delete)
  - DO NOT touch RequestLogPanel, AddAccountForm, or other components

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI layout restructuring, requires CSS/JSX visual adjustments
  - **Skills**: [`ui-ux-pro-max`]
    - `ui-ux-pro-max`: Layout restructuring and visual balance

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1-F4
  - **Blocked By**: None

  **References**:
  - `web/src/components/AccountCard.tsx:365-403` — Card header row structure
  - `web/src/components/AccountCard.tsx:451-498` — Current horizontal toggle row to remove/restructure
  - `web/src/components/AccountCard.tsx:228-259` — AccountActions component (stays on right)
  - `web/src/index.css:29-34` — CSS variables for spacing

  **Acceptance Criteria**:
  - [ ] Toggles appear on right side of card header
  - [ ] Toggles stacked vertically (not horizontal)
  - [ ] Layout is visually balanced
  - [ ] No horizontal toggle row below priority row

  **QA Scenarios**:
  ```
  Scenario: Toggles on right side stacked vertically
    Tool: Playwright
    Preconditions: Server running, at least one account card visible
    Steps:
      1. Navigate to http://localhost:4141/
      2. Find an account card
      3. Assert "Rate Limit Wait" toggle is visible in the header area
      4. Assert "Manual Approve" toggle is visible below it
      5. Assert toggles are on the right side of the card
    Expected Result: Toggles stacked vertically on right
    Evidence: .sisyphus/evidence/task-4-toggle-layout.png

  Scenario: Toggle functionality unchanged
    Tool: Playwright
    Preconditions: Server running, account with Rate Limit Wait = false
    Steps:
      1. Navigate to http://localhost:4141/
      2. Click Rate Limit Wait toggle
      3. Reload page
      4. Assert toggle is now checked
    Expected Result: Toggle state persists correctly
    Evidence: .sisyphus/evidence/task-4-toggle-function.png
  ```

  **Commit**: NO (group with all tasks)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Build & Lint Verification** — `quick`
  Run `cd /home/ritel/copilot-api && bun run build` and `bun run lint`. Both must pass with exit code 0.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | VERDICT: APPROVE/REJECT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Test edge cases. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`
---

## Commit Strategy

- **Single commit** after all tasks complete:
  - Message: `fix(webui): usage persistence, unified query logic, reduced masking, toggle layout`
  - Pre-commit: `cd web && bun run build && bun run lint`

---

## Success Criteria

### Verification Commands
```bash
# Backend route exists and returns data
curl -s http://localhost:4141/api/accounts/usage/cached | jq '.'

# Frontend build passes
cd /home/ritel/copilot-api && bun run build

# Lint passes
bun run lint
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] Build passes
- [x] Lint passes
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Build passes
- [ ] Lint passes
