# Architecture Overview

## 目标

- 保持页面开发效率，同时保证可维护的分层边界
- 让业务代码可测试、可替换（mock -> real API）
- 降低跨页面复用成本

## 分层约定

### `src/app`（UI / Route Layer）

- 职责：页面渲染、用户交互、路由组织
- 不做：数据源细节、协议细节、复杂业务规则
- 依赖方向：`app -> api -> domains`

### `src/api`（Facade Layer）

- 职责：给页面提供稳定、简洁的调用接口
- 特点：薄封装，少逻辑，主要做调用编排
- 示例：`fetchModules()`

### `src/domains`（Domain Layer）

- 职责：核心业务模型、用例、仓储接口/实现
- 结构建议：
  - `model.ts`：领域类型
  - `usecases/`：业务用例
  - `repositories/`：数据访问实现
  - `sources/`：mock / remote source
- 依赖方向：`domains` 不依赖 `app`

### `src/services`（Compatibility / Cross-Cutting）

- 当前保留为兼容层和通用能力入口
- 目标：逐步把业务逻辑迁入 `domains`

### `src/pages/api`（Server Endpoint Layer）

- 职责：后端入口（HTTP/WS），鉴权、限流、输入校验
- 示例：`/api/ws/socket`、`/api/ws/publish`

## 已落地的架构优化

- `modules` 领域已迁移到 `src/domains/module`
- `src/api/modules.ts` 成为 facade，避免页面直接依赖底层实现
- `src/services/modules.ts` 保留兼容导出，避免一次性破坏旧引用

## 依赖规则

- 页面层只能依赖 `api`（或非常薄的 view model）
- 禁止页面直接导入 `repositories` / `sources`
- `domains` 内允许：
  - `usecases -> repositories -> sources`
- `pages/api` 允许调用 `domains` 或通用 `services`

## 未来演进建议

- 为每个业务子域建立 `src/domains/<domain>`
- 在 `domains/repositories` 中分离 `mock` 与 `remote` 实现
- 引入统一错误模型（业务错误码 + 用户可展示文案）
- 用测试覆盖关键 usecase（至少单测）
