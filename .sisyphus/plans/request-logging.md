# Request Logging System for copilot-api

## TL;DR

> **Quick Summary**: Add a structured request logging system that records which account requested which model, success/error status, and basic metrics. Display logs in WebUI with filtering capabilities.
> 
> **Deliverables**:
> - JSONL-based request log storage with 7-day retention
> - `/api/logs` API endpoint with account/status filtering
> - WebUI `RequestLogPanel` component with toggle-open display
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves (backend + frontend)
> **Critical Path**: Backend log module → API endpoint → Frontend component

---

## Context

### Original Request
用户要求添加一个简单的日志系统，至少能够记录何时哪个账号请求了哪个模型，有无报错等基本信息，并在WebUI中添加一个页面显示。

### Interview Summary
**Key Discussions**:
- **日志保留**: 7天自动清理，与现有 `logger.ts` 系统一致
- **日志内容**: 包含 timestamp, accountId, accountName, model, endpoint, success, statusCode, errorMessage, latencyMs, isStreaming, poolMode, inputTokens, outputTokens
- **WebUI功能**: 基础功能 - 时间倒序显示、按账号筛选、按状态（成功/失败）筛选
- **Token统计**: 包含 inputTokens/outputTokens，但流式请求默认为 null

**Research Findings**:
- 现有 `src/lib/logger.ts` 有完整的缓冲写入和日志轮转模式可复用
- 请求流程: `proxyAuth → withPoolRetry → completionsHandler → upstream fetch`
- 前端无 React Router，使用单页条件渲染，遵循 `BatchUsagePanel` 模式

### Metis Review
**Critical Issues Identified**:
1. `proxyAuth` 不存储 `accountName` - 必须同时存储 accountId 和 accountName
2. `withPoolRetry` 重试时最终账号信息被遮蔽 - 日志必须在 handler 返回后记录
3. 流式响应 body 不缓冲，无法捕获 outputTokens - 默认为 null
4. 需要每日 JSONL 文件轮转，避免单文件无限增长

**Resolution**:
- 日志记录位置: 在 `withPoolRetry` 内部（handler 返回后）
- Token 字段: 流式请求默认 null，不调用 tokenizer
- 文件轮转: 每日 JSONL 文件，与现有 `logger.ts` 模式一致
- 异步写入: `void appendLogEntry(...)` 避免延迟

---

## Work Objectives

### Core Objective
实现结构化请求日志系统，记录每个 API 请求的关键信息，并在 WebUI 中提供查看界面。

### Concrete Deliverables
- `src/lib/request-log.ts` - 日志模块（写入、读取、清理）
- `src/lib/paths.ts` - 添加 `REQUEST_LOG_DIR` 路径
- `src/console/index.ts` - 在 `withPoolRetry` 中添加日志记录
- `src/console/api.ts` - 添加 `/api/logs` 端点
- `web/src/components/RequestLogPanel.tsx` - 日志显示组件
- `web/src/api.ts` - 添加 `getLogs()` API 方法
- `web/src/i18n.tsx` - 添加中英文翻译

### Definition of Done
- [ ] 请求日志正确记录到 JSONL 文件
- [ ] `/api/logs` 返回按时间倒序的日志列表
- [ ] 支持按 account 和 status 筛选
- [ ] WebUI 显示日志面板，支持筛选
- [ ] 7天自动清理旧日志文件
- [ ] Lint 和 Build 通过

### Must Have
- 日志记录: timestamp, accountId, accountName, model, endpoint, success, statusCode
- WebUI: 时间倒序、按账号筛选、按状态筛选
- 7天日志保留

### Must NOT Have (Guardrails)
- 不修改 `src/server.ts` (仅 console 模式)
- 不记录 `/v1/models` 请求
- 不在热路径调用 `getTokenCount()`
- 不缓冲流式响应
- 不添加实时刷新、导出、详情弹窗

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **Automated tests**: NO (tests-after for new features)
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Backend API**: Use Bash (curl) — Send requests, assert status + response fields
- **Frontend UI**: Use Bash (build) — Verify TypeScript compilation

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Backend - foundation):
├── Task 1: Add REQUEST_LOG_DIR to paths.ts [quick]
├── Task 2: Create request-log.ts module [unspecified-high]
├── Task 3: Add accountName to proxyAuth context [quick]
└── Task 4: Integrate logging into withPoolRetry [unspecified-high]

Wave 2 (API + Frontend):
├── Task 5: Add /api/logs endpoint [quick]
├── Task 6: Add getLogs() to web/src/api.ts [quick]
├── Task 7: Add i18n translations for logs [quick]
└── Task 8: Create RequestLogPanel component [visual-engineering]

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix

- **1-4**: No dependencies (can run in parallel with minor ordering)
- **5**: Depends on 2
- **6**: Depends on 5
- **7-8**: Depends on 6
- **FINAL**: Depends on ALL

### Agent Dispatch Summary

- **Wave 1**: 4 tasks → quick(2) + unspecified-high(2)
- **Wave 2**: 4 tasks → quick(3) + visual-engineering(1)
- **FINAL**: 4 tasks → oracle(1) + unspecified-high(2) + deep(1)

---

- [ ] 1. Add REQUEST_LOG_DIR to paths.ts

  **What to do**:
  - Add `REQUEST_LOG_DIR` constant pointing to `~/.local/share/copilot-api/logs`
  - Add directory creation in `ensurePaths()` function

  **Must NOT do**:
  - Do NOT modify other paths or add file paths (directory only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Single-file, <10 line change, straightforward path addition

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 2 (needs the path constant)
  - **Blocked By**: None

  **References**:
  - `src/lib/paths.ts:1-31` - Existing PATHS pattern and ensurePaths function
  - `src/lib/logger.ts:12` - LOG_DIR pattern to follow

  **Acceptance Criteria**:
  - [ ] `PATHS.REQUEST_LOG_DIR` defined
  - [ ] `ensurePaths()` creates the logs directory

  **QA Scenarios**:
  ```
  Scenario: Path constant exists
    Tool: Bash (grep)
    Steps:
      1. grep -n "REQUEST_LOG_DIR" src/lib/paths.ts
    Expected Result: Line found with path definition
    Evidence: .sisyphus/evidence/task-1-path-exists.txt
  ```

  **Commit**: NO (groups with Task 2)

- [ ] 2. Create request-log.ts module

  **What to do**:
  - Create `src/lib/request-log.ts`
  - Define `RequestLogEntry` interface with all fields
  - Implement `appendLogEntry(entry)` - fire-and-forget append to JSONL
  - Implement `readLogs(options)` - read with filtering and pagination
  - Implement `cleanupOldLogs()` - delete JSONL files older than 7 days
  - Use daily file naming: `request-logs-YYYY-MM-DD.jsonl`

  **Must NOT do**:
  - Do NOT call tokenizer on hot path
  - Do NOT buffer streaming responses
  - Do NOT add WebSocket/SSE features

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: New module with multiple functions, requires careful design

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4, Task 5
  - **Blocked By**: Task 1 (needs REQUEST_LOG_DIR)

  **References**:
  - `src/lib/logger.ts:19-54` - cleanupOldLogs pattern to follow
  - `src/lib/logger.ts:111-123` - appendLine pattern to follow
  - `src/console/usage-cache.ts` - JSON read/write pattern

  **Acceptance Criteria**:
  - [ ] `appendLogEntry()` writes to daily JSONL file
  - [ ] `readLogs()` returns filtered, reverse-chronological results
  - [ ] `cleanupOldLogs()` removes files older than 7 days

  **QA Scenarios**:
  ```
  Scenario: Module exports exist
    Tool: Bash (grep)
    Steps:
      1. grep -n "export.*appendLogEntry\|export.*readLogs\|export.*cleanupOldLogs" src/lib/request-log.ts
    Expected Result: All three exports found
    Evidence: .sisyphus/evidence/task-2-exports.txt
  ```

  **Commit**: YES (with Task 1)
  - Message: `feat(logging): add request log module and storage`
  - Files: `src/lib/paths.ts`, `src/lib/request-log.ts`

- [ ] 3. Add accountName to proxyAuth context

  **What to do**:
  - In `src/console/index.ts:proxyAuth`, store both `accountId` and `accountName` on context
  - For per-account mode: `c.set("proxyAccountId", account.id)` and `c.set("proxyAccountName", account.name)`
  - For pool mode: Same pattern after `selectAccount()` returns

  **Must NOT do**:
  - Do NOT change auth logic
  - Do NOT log at this point (logging happens later)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: <5 line change, adding context variables

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `src/console/index.ts:190-227` - proxyAuth function to modify
  - `src/console/index.ts:222-226` - Where poolAccountId is currently set

  **Acceptance Criteria**:
  - [ ] Both `proxyAccountId` and `proxyAccountName` set on context for both modes

  **QA Scenarios**:
  ```
  Scenario: Context variables added
    Tool: Bash (grep)
    Steps:
      1. grep -n "proxyAccountName" src/console/index.ts
    Expected Result: Lines found with c.set for proxyAccountName
    Evidence: .sisyphus/evidence/task-3-context.txt
  ```

  **Commit**: NO (groups with Task 4)

- [ ] 4. Integrate logging into withPoolRetry

  **What to do**:
  - In `src/console/index.ts:withPoolRetry`, wrap the handler call with timing
  - Capture: startTime, response status, latency
  - Read accountId/accountName from context after handler returns (final account after retries)
  - Read model from `bufferedBody` or request payload
  - Call `appendLogEntry()` with fire-and-forget: `void appendLogEntry(...)`

  **Log Entry Fields**:
  - timestamp: `new Date().toISOString()` (UTC)
  - accountId: from `c.get("proxyAccountId")`
  - accountName: from `c.get("proxyAccountName")`
  - model: from request body `payload.model`
  - endpoint: from `c.req.path`
  - success: `response.status < 400`
  - statusCode: `response.status`
  - errorMessage: extracted from response body if error
  - latencyMs: `Date.now() - startTime`
  - isStreaming: from `payload.stream`
  - poolMode: from `c.get("poolMode")`
  - inputTokens: null (skip tokenizer)
  - outputTokens: null (no stream buffering)

  **Must NOT do**:
  - Do NOT await the log write (fire-and-forget)
  - Do NOT buffer streaming responses
  - Do NOT call tokenizer

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Reason**: Core integration point, requires careful timing and error handling

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 2, 3)
  - **Parallel Group**: Wave 1 (after Tasks 1-3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 2 (needs appendLogEntry), Task 3 (needs context vars)

  **References**:
  - `src/console/index.ts:238-278` - withPoolRetry function to modify
  - `src/console/instance-manager.ts:230-306` - completionsHandler shows payload access

  **Acceptance Criteria**:
  - [ ] Log entry written for each request through withPoolRetry
  - [ ] Log captures correct final accountId after retries
  - [ ] Latency measured accurately

  **QA Scenarios**:
  ```
  Scenario: Log file created on request
    Tool: Bash (curl + test)
    Preconditions: Server running on port 4141, valid API key
    Steps:
      1. curl -X POST http://localhost:4141/v1/chat/completions -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
      2. sleep 1
      3. test -f ~/.local/share/copilot-api/logs/request-logs-*.jsonl
    Expected Result: Log file exists with entry
    Evidence: .sisyphus/evidence/task-4-log-created.txt
  ```

  **Commit**: YES
  - Message: `feat(logging): integrate logging into proxy handlers`
  - Files: `src/console/index.ts`
  - Pre-commit: `bun run lint`

- [ ] 5. Add /api/logs endpoint

  **What to do**:
  - In `src/console/api.ts`, add `GET /logs` endpoint
  - Query params: `account` (filter by accountId), `status` (success/error), `limit` (default 100)
  - Call `readLogs()` from request-log module
  - Return JSON array of log entries

  **Must NOT do**:
  - Do NOT expose unauthenticated (auth middleware already covers this)
  - Do NOT return raw file contents (use readLogs)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Standard Hono endpoint, <20 lines

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 2)
  - **Parallel Group**: Wave 2 (with Tasks 6, 7)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2 (needs readLogs)

  **References**:
  - `src/console/api.ts:105-123` - Existing endpoint pattern
  - `src/console/api.ts:92-99` - Auth middleware placement

  **Acceptance Criteria**:
  - [ ] `GET /api/logs` returns JSON array
  - [ ] `?account=<id>` filters by accountId
  - [ ] `?status=error` returns only failed requests

  **QA Scenarios**:
  ```
  Scenario: API returns 401 without auth
    Tool: Bash (curl)
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/logs
    Expected Result: 401
    Evidence: .sisyphus/evidence/task-5-auth.txt

  Scenario: API returns array with auth
    Tool: Bash (curl)
    Preconditions: Valid session token
    Steps:
      1. curl -s http://localhost:3000/api/logs -H "Authorization: Bearer $TOKEN" | jq 'type'
    Expected Result: "array"
    Evidence: .sisyphus/evidence/task-5-array.txt
  ```

  **Commit**: NO (groups with Tasks 6-8)

- [ ] 6. Add getLogs() to web/src/api.ts

  **What to do**:
  - Add `LogEntry` interface matching backend response
  - Add `getLogs(params)` function with optional account/status filters
  - Use existing `request<T>()` helper

  **Must NOT do**:
  - Do NOT add WebSocket/SSE features

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: <15 lines, standard API function

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 5 (needs endpoint)

  **References**:
  - `web/src/api.ts:93-108` - request helper pattern
  - `web/src/api.ts:127-128` - getAccounts example

  **Acceptance Criteria**:
  - [ ] `api.getLogs()` function exists
  - [ ] TypeScript type for LogEntry defined

  **QA Scenarios**:
  ```
  Scenario: API function exists
    Tool: Bash (grep)
    Steps:
      1. grep -n "getLogs" web/src/api.ts
    Expected Result: Function definition found
    Evidence: .sisyphus/evidence/task-6-api.txt
  ```

  **Commit**: NO (groups with Tasks 5, 7, 8)

- [ ] 7. Add i18n translations for logs

  **What to do**:
  - Add log-related translation keys to both `en` and `zh` objects in `web/src/i18n.tsx`
  - Keys needed: logs, showLogs, hideLogs, colTimestamp, colAccount, colModel, colStatus, colLatency, filterByAccount, filterByStatus, allAccounts, successOnly, errorOnly, noLogs

  **Must NOT do**:
  - Do NOT add keys to only one locale (TypeScript will error)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: <20 lines, straightforward i18n addition

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:
  - `web/src/i18n.tsx:7-104` - English translations
  - `web/src/i18n.tsx:109-206` - Chinese translations

  **Acceptance Criteria**:
  - [ ] All log keys added to both `en` and `zh`
  - [ ] TypeScript compiles without errors

  **QA Scenarios**:
  ```
  Scenario: TypeScript compiles
    Tool: Bash (tsc)
    Steps:
      1. cd web && bun run build 2>&1 | head -20
    Expected Result: No TypeScript errors
    Evidence: .sisyphus/evidence/task-7-i18n.txt
  ```

  **Commit**: NO (groups with Tasks 5, 6, 8)

- [ ] 8. Create RequestLogPanel component

  **What to do**:
  - Create `web/src/components/RequestLogPanel.tsx`
  - Follow `BatchUsagePanel` pattern: toggle-open, on-demand fetch
  - Display table with: timestamp, accountName, model, endpoint, status, latency
  - Filter dropdowns for account and status
  - Use `useT()` for i18n
  - Add to `App.tsx` Dashboard below BatchUsagePanel

  **Must NOT do**:
  - Do NOT add auto-refresh (on-demand only)
  - Do NOT add export functionality
  - Do NOT add detail modal/drill-down

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Reason**: New UI component with table, filters, i18n

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 6, 7)
  - **Parallel Group**: Wave 2 (after Tasks 5-7)
  - **Blocks**: None
  - **Blocked By**: Task 6 (needs getLogs), Task 7 (needs i18n keys)

  **References**:
  - `web/src/App.tsx:402-532` - BatchUsagePanel pattern to follow
  - `web/src/components/AccountCard.tsx` - Component style pattern

  **Acceptance Criteria**:
  - [ ] Component renders toggle button
  - [ ] Table displays log entries on fetch
  - [ ] Filter dropdowns work
  - [ ] i18n works for both en/zh

  **QA Scenarios**:
  ```
  Scenario: Frontend builds
    Tool: Bash (build)
    Steps:
      1. cd web && bun run build
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-8-build.txt
  ```

  **Commit**: YES (with Tasks 5-7)
  - Message: `feat(logging): add /api/logs endpoint and WebUI panel`
  - Files: `src/console/api.ts`, `web/src/api.ts`, `web/src/i18n.tsx`, `web/src/components/RequestLogPanel.tsx`, `web/src/App.tsx`
  - Pre-commit: `cd web && bun run build && bun run lint`

---

## Final Verification Wave

### F1. Plan Compliance Audit (oracle)
Read plan end-to-end. Verify all "Must Have" implemented. Verify no "Must NOT Have" present.

### F2. Code Quality Review (unspecified-high)
Run `bun run lint` + `bun run build`. Verify 0 errors.

### F3. Real Manual QA (unspecified-high)
- Start server with `bun run dev`
- Make test requests
- Verify logs appear in WebUI

### F4. Scope Fidelity Check (deep)
Verify implementation matches spec exactly. No scope creep.

---

## Commit Strategy

- **Commit 1**: `feat(logging): add request log module and storage` (Tasks 1-2)
- **Commit 2**: `feat(logging): integrate logging into proxy handlers` (Tasks 3-4)
- **Commit 3**: `feat(logging): add /api/logs endpoint and WebUI panel` (Tasks 5-8)

---

## Success Criteria

### Verification Commands
```bash
# Verify log file created
test -f ~/.local/share/copilot-api/logs/request-logs-*.jsonl && echo "OK"

# Verify API returns logs
curl -s http://localhost:3000/api/logs -H "Authorization: Bearer $TOKEN" | jq 'type' # → "array"

# Verify lint passes
bun run lint # → 0 problems

# Verify build passes
bun run build # → exit 0
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All builds pass
- [ ] All lints pass
