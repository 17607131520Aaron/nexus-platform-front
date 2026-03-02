# WebSocket Security Guide

本文档说明 `src/pages/api/ws/socket.ts` 与 `src/pages/api/ws/publish.ts` 的安全配置、鉴权方式与联调方法。

## 安全能力

- 鉴权：支持 `socket.handshake.auth.token`、`Authorization: Bearer <token>`、`x-auth-token`、`auth_token` cookie
- Origin 白名单：限制允许连接和发布的来源
- 消息类型白名单：限制可发布的业务事件类型
- 消息体大小限制：限制单条消息 payload 字节数
- 速率限制：限制单位时间内的发布次数（WS/HTTP 统一策略）

## 环境变量

- `WS_AUTH_REQUIRED`：是否强制鉴权。`production` 默认 `true`，其它环境默认 `false`
- `WS_AUTH_TOKEN`：单个有效 token
- `WS_AUTH_TOKENS`：多个有效 token，逗号分隔
- `WS_ALLOWED_ORIGINS`：允许来源，逗号分隔，例如 `https://a.com,https://b.com`
- `WS_ALLOWED_MESSAGE_TYPES`：允许发布的类型，逗号分隔，例如 `rn-logs-connect,server-log`
- `WS_MAX_PAYLOAD_BYTES`：消息 payload 最大字节数，默认 `16384`
- `WS_RATE_LIMIT_MAX`：窗口内最多发布次数，默认 `60`
- `WS_RATE_LIMIT_WINDOW_MS`：限流窗口毫秒数，默认 `60000`

## 推荐生产配置

```bash
WS_AUTH_REQUIRED=true
WS_AUTH_TOKENS=token_a,token_b
WS_ALLOWED_ORIGINS=https://your-app.example.com
WS_ALLOWED_MESSAGE_TYPES=rn-logs-connect,server-log,js-log
WS_MAX_PAYLOAD_BYTES=16384
WS_RATE_LIMIT_MAX=120
WS_RATE_LIMIT_WINDOW_MS=60000
```

## 客户端连接示例（socket.io-client）

```ts
import { io } from "socket.io-client";

const socket = io("https://your-app.example.com", {
  path: "/api/ws/socket",
  auth: { token: "token_a" },
});
```

## HTTP 发布示例

```bash
curl -X POST "https://your-app.example.com/api/ws/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token_a" \
  -d '{"type":"server-log","payload":{"message":"hello"},"from":"ops"}'
```

## 返回码约定（publish）

- `200`：发布成功
- `400`：参数非法（类型不允许、payload 超限等）
- `401`：鉴权失败
- `403`：来源不在白名单
- `429`：超过速率限制
