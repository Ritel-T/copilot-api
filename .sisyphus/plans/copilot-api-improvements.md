# Copilot-API 改进计划：VSCode 官方客户端模拟增强

## TL;DR

> **Quick Summary**: 改进 copilot-api 项目的认证机制、请求头模拟、错误处理和 Token 管理，以更好地模拟 VSCode Copilot 官方客户端，提高兼容性和稳定性。
>
> **Deliverables**:
> - 修复 Token 刷新竞态条件和错误处理
> - 添加设备 ID 持久化和请求头
> - 增强错误分类和处理
> - 添加用户信息获取和免费账户检测
> - 添加诊断命令 `--diagnose`
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 5 → Task 6

---

## Context

### Original Request
用户希望改进 copilot-api 项目，以更好地模拟 VSCode Copilot 官方客户端，达到最大兼容性和稳定性。同时分析为什么免费账户会报错 "Failed to get Copilot token"。

### Interview Summary

**关键发现**:

1. **免费账户限制**:
   - GitHub Copilot Free **不支持 API 访问**（官方文档确认）
   - `/copilot_internal/v2/token` 端点需要有效的 Copilot 订阅
   - 这是 GitHub 产品限制，不是技术问题

2. **认证机制差异**:
   - 本项目: 独立 Device Flow，固定 Client ID `Ov23liOOj27Iqq5BVNMf`
   - VSCode: 内置认证系统，动态 scope 选择

3. **Token 管理问题** (Metis 发现):
   - 竞态条件：`setInterval` 可能并发刷新
   - 错误处理：`throw error` 在 setInterval 中会静默失败
   - 刷新时机：提前 1 分钟 vs VSCode 提前 5 分钟

4. **请求头缺失**:
   - 缺少 `Editor-Device-Id`、`X-Agent-Task-Id`、`X-Interaction-Type`
   - `x-github-api-version`: 项目使用 `2025-10-01`，VSCode 使用 `2025-04-01`

### Metis Review

**Identified Gaps** (addressed):

1. **Token 竞态条件** (高优先级): `setInterval` 没有互斥锁，可能并发刷新
2. **setInterval 静默失败**: `throw error` 不会清理定时器
3. **x-github-api-version 版本**: 需要验证当前版本是否正确
4. **Editor-Device-Id**: 需要先在 State 中添加字段
5. **OAuth scope 变更**: 会强制用户重新认证

**Scope Boundaries**:
- IN: Token 管理修复、错误分类、设备 ID、用户信息获取、诊断工具
- OUT: Responses API 翻译逻辑、路由结构、重试逻辑、遥测系统、加密存储

---

## Work Objectives

### Core Objective
改进 copilot-api 项目的核心认证和请求机制，提高稳定性和兼容性，同时提供更好的用户反馈。

### Concrete Deliverables
1. `src/lib/token.ts` - 修复竞态条件和错误处理
2. `src/lib/device-id.ts` - 新增设备 ID 管理
3. `src/lib/api-config.ts` - 添加设备 ID 请求头
4. `src/lib/errors.ts` - 新增错误分类系统
5. `src/services/github/get-copilot-user-info.ts` - 新增用户信息获取
6. `src/start.ts` - 添加诊断命令支持
7. 相关测试文件

### Definition of Done
- [ ] 所有新功能有对应测试
- [ ] `bun test` 全部通过
- [ ] `bun run lint` 零错误
- [ ] `bun run build` 成功
- [ ] 现有功能无回归

### Must Have
- Token 刷新竞态条件修复
- 错误处理改进
- 设备 ID 持久化
- 用户信息获取和免费账户检测

### Must NOT Have (Guardrails)
- 不修改 Responses API 翻译逻辑 (`create-responses.ts`)
- 不修改路由结构
- 不添加重试逻辑（单独关注点）
- 不添加遥测系统
- 不修改 OAuth scope（需要单独讨论）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **Automated tests**: TDD - 每个任务先写测试
- **Framework**: bun test

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 4 tasks parallel):
├── Task 1: Token race condition fix [quick]
├── Task 2: Error categorization system [quick]
├── Task 3: Device ID implementation [quick]
└── Task 4: User info service [quick]

Wave 2 (Integration - 3 tasks after Wave 1):
├── Task 5: Add device ID headers [quick]
├── Task 6: Free account detection in startup [quick]
└── Task 7: Diagnostics command [quick]

Wave FINAL (Verification - after ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Test coverage verification (unspecified-high)
└── Task F4: Regression testing (deep)

Critical Path: Task 1 → Task 5 → Task 6 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 4 (Wave 1)
```

### Agent Dispatch Summary
- **Wave 1**: **4** — All `quick`
- **Wave 2**: **3** — All `quick`
- **FINAL**: **4** — F1 → `oracle`, F2-F3 → `unspecified-high`, F4 → `deep`

---

## TODOs


- [ ] 1. **Token 竞态条件修复**

  **What to do**:
  - 在 `src/lib/token.ts` 中添加互斥锁，防止并发刷新
  - 修复 `setInterval` 中的错误处理
  - 添加 `isRefreshing` 标志变量

  **Parallelization**: Wave 1, Blocks: Task 5, 6
  **Commit**: `fix(token): add mutex lock and proper error handling`

- [ ] 2. **错误分类系统**

  **What to do**:
  - 创建 `src/lib/errors.ts`
  - 定义 `CopilotErrorCode` 枚举和 `CopilotError` 类

  **Parallelization**: Wave 1
  **Commit**: `feat(errors): add error categorization system`

- [ ] 3. **设备 ID 实现**

  **What to do**:
  - 创建 `src/lib/device-id.ts`
  - 实现 `getDeviceId()` 和 `getSessionId()`

  **Parallelization**: Wave 1, Blocks: Task 5
  **Commit**: `feat: add device-id generation`

- [ ] 4. **用户信息服务**

  **What to do**:
  - 创建 `src/services/github/get-copilot-user-info.ts`
  - 调用 `/copilot_internal/user` 端点

  **Parallelization**: Wave 1, Blocks: Task 6
  **Commit**: `feat: add copilot user info service`

- [ ] 5. **添加设备 ID 请求头**

  **What to do**:
  - 修改 `src/lib/api-config.ts`
  - 添加 `Editor-Device-Id` header

  **Parallelization**: Wave 2, Blocked By: Task 3
  **Commit**: `feat: add device-id header`

- [ ] 6. **免费账户检测**

  **What to do**:
  - 修改 `src/lib/token.ts` 的 `setupCopilotToken`
  - 检测免费用户并显示错误

  **Parallelization**: Wave 2, Blocked By: Task 1, 4
  **Commit**: `feat: add free account detection`

- [ ] 7. **诊断命令**

  **What to do**:
  - 添加 `--diagnose` 参数
  - 创建 `src/lib/diagnostics.ts`

  **Parallelization**: Wave 2, Blocked By: Task 4
  **Commit**: `feat: add diagnostics command`

- [ ] 8. **OAuth Scope 变更**

  **What to do**:
  - 修改 `src/lib/api-config.ts` 中的 `GITHUB_APP_SCOPES`
  - 从 `read:user` 改为 `user:email`
  - 添加旧 token 检测逻辑

  **Parallelization**: Wave 2
  **Commit**: `feat: change OAuth scope to user:email`
  **Note**: 这会强制所有现有用户重新认证


- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `bun run lint` + `bun test`. Review all changed files for: `as any`, empty catches, console.log in prod, unused imports.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [ ] F3. **Test Coverage Verification** — `unspecified-high`
  Verify each new module has corresponding test file. Check test assertions are meaningful.
  Output: `Test Files [N/N] | Assertions [N] | VERDICT`

- [ ] F4. **Regression Testing** — `deep`
  Start server, test all endpoints with curl, verify responses match expected format.
  Output: `Endpoints [N/N] | Responses [N valid] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `fix(token): add mutex lock and proper error handling in token refresh` — token.ts, errors.ts
- **Wave 2**: `feat: add device-id, user-info, and free account detection` — device-id.ts, get-copilot-user-info.ts, api-config.ts, start.ts

---

## Success Criteria

### Verification Commands
```bash
bun test                    # Expected: all tests pass
bun run lint                # Expected: zero errors
bun run build               # Expected: clean build
bun run start --diagnose    # Expected: diagnostics output
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No lint errors
