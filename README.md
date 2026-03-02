# Nexus Platform Frontend

基于 Next.js 16 + React 19 的前端项目，包含：

- 模块门户首页（模块搜索/筛选）
- `dev-tools` 工具区（RN 日志、网络调试等）
- Socket.IO 网关与客户端通用 Hook

## 本地启动

```bash
pnpm install
pnpm dev
```

默认打开 `http://localhost:3000`。

## 常用脚本

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format
pnpm stylelint
```

## 项目架构

- 详细架构说明：`docs/architecture.md`
- Socket 安全配置：`docs/ws-security.md`
- Socket Hook 文档：`docs/useSocket.md`

## 目录分层（核心）

- `src/app`: 页面与布局（UI 入口）
- `src/api`: 面向页面的 API facade（薄层）
- `src/domains`: 领域模型与用例（主业务层）
- `src/services`: 兼容层/跨域能力（逐步收敛到 domains）
- `src/hooks`: 复用 Hook
- `src/pages/api`: Next API Route（如 WS 网关）

## 环境变量（WS）

参考 `docs/ws-security.md`，重点包括：

- `WS_AUTH_REQUIRED`
- `WS_AUTH_TOKEN` / `WS_AUTH_TOKENS`
- `WS_ALLOWED_ORIGINS`
- `WS_ALLOWED_MESSAGE_TYPES`
- `WS_MAX_PAYLOAD_BYTES`
- `WS_RATE_LIMIT_MAX`
- `WS_RATE_LIMIT_WINDOW_MS`
