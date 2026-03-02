# useSocket（socket.io-client）使用文档

位置：`src/hooks/useSocket/useSocket.ts`

这是一个基于 `socket.io-client` 的通用 React Hook，提供：

- 自动连接（默认开启）
- 断线自动重连/自动重试（默认最多 5 次）
- 可配置是否自动重连（默认开启）
- 可配置重连延迟（默认 1000ms）
- 可配置连接超时（默认 5000ms）
- 支持 `auth`、`query`、`path`、`transports`、`withCredentials`
- 支持注入 `extraHeaders`（注意浏览器限制，见下文）
- 支持 `emitWithAck`（ACK 超时控制）
- 支持离线消息队列（默认开启）
- 支持鉴权失败后自动刷新 auth 并重连

> 注意：该 Hook 是 Client Component（文件顶部包含 `"use client"`），只能在 Next.js 的客户端组件中使用。

---

## 快速开始

### 1）最简用法

```tsx
'use client';

import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket/useSocket';

type ServerToClientEvents = {
  message: (payload: { text: string }) => void;
};

type ClientToServerEvents = {
  sendMessage: (text: string) => void;
};

export function Demo() {
  const { status, connected, error, emit, on } = useSocket<
    ServerToClientEvents,
    ClientToServerEvents
  >({
    url: 'https://your-socket-server.com',
    auth: { token: 'YOUR_TOKEN' },
  });

  useEffect(() => {
    const off = on('message', (payload) => {
      console.log('message:', payload.text);
    });
    return off;
  }, [on]);

  return (
    <div>
      <div>status: {status}</div>
      <div>connected: {String(connected)}</div>
      {error && <div>error: {error.message}</div>}

      <button disabled={!connected} onClick={() => emit('sendMessage', 'hello')}>
        发送
      </button>
    </div>
  );
}
```

---

## 配置项（UseSocketConfig）

```ts
useSocket({
  url,
  enabled,
  autoConnect,
  timeout,
  reconnection,
  reconnectionAttempts,
  reconnectionDelay,
  ackTimeout,
  offlineQueue,
  maxOfflineQueueSize,
  refreshAuth,
  isAuthError,
  extraHeaders,
  auth,
  query,
  path,
  transports,
  withCredentials,
  forceNew,
  multiplex,
  ioOptions,
  onConnect,
  onDisconnect,
  onError,
  onReconnectAttempt,
  onReconnect,
  onReconnectFailed,
  onAuthRefreshFailed,
  onQueueDrain,
})
```

### 常用字段与默认值

- **`url`**：必填，socket 服务地址
- **`enabled`**：是否启用（默认 `true`）。为 `false` 时会清理 socket，并将状态置为 `idle`
- **`autoConnect`**：是否自动连接（默认 `true`）
- **`timeout`**：连接超时（毫秒，默认 `5000`）
- **`reconnectionAttempts`**：最大重试次数（默认 `5`）
- **`reconnectionDelay`**：重连延迟（毫秒，默认 `1000`）
- **`reconnection`**：是否开启自动重连（默认 `true`）
- **`ackTimeout`**：`emitWithAck` 默认超时时间（毫秒，默认 `10000`）
- **`offlineQueue`**：是否启用离线队列（默认 `true`）
- **`maxOfflineQueueSize`**：离线队列上限（默认 `100`，超出时丢弃最早消息）
- **`refreshAuth`**：鉴权失败时自动刷新 auth 的异步函数
- **`isAuthError`**：自定义鉴权错误判断函数
- **`auth`**：推荐用于浏览器传 token（例如 `{ token }`）
- **`query`**：查询参数（会被归一化为字符串）
- **`extraHeaders`**：额外请求头（见下方“浏览器 extraHeaders 限制”）
- **`ioOptions`**：兜底透传原生 `socket.io-client` 选项（优先级高于默认值；`transportOptions` 会做浅合并）

### 回调

- **`onConnect(socket)`**：连接成功
- **`onDisconnect(reason, socket)`**：断开连接
- **`onError(error)`**：连接/重连过程错误
- **`onReconnectAttempt(attempt)`**：开始第 `attempt` 次重连
- **`onReconnect(attempt)`**：重连成功
- **`onReconnectFailed()`**：达到最大次数仍失败
- **`onAuthRefreshFailed(error)`**：鉴权刷新失败
- **`onQueueDrain(count)`**：离线队列消息发送完成回调

> 建议使用这些回调处理 connect/disconnect/reconnect 等保留事件；业务事件用 `on()`/`off()`。

---

## 返回值（UseSocketResult）

```ts
const {
  socket,
  status,
  connected,
  id,
  error,
  reconnectAttempt,
  connect,
  disconnect,
  emit,
  emitWithAck,
  on,
  off,
} = useSocket(...)
```

- **`status`**：`'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'`
- **`connected`**：是否已连接
- **`reconnectAttempt`**：当前重连次数（由 socket.io 的重连事件驱动）
- **`connect()`**：手动连接（搭配 `autoConnect: false`）
- **`disconnect()`**：手动断开
- **`emit(event, ...args)`**：发送事件（带 TS 类型提示）
- **`emitWithAck(event, ...args)`**：发送并等待 ACK，超时会 reject（由 `ackTimeout` 控制）
- **`on(event, listener)`**：订阅服务端事件，返回取消订阅函数
- **`off(event, listener?)`**：取消订阅

---

## 手动连接模式（autoConnect: false）

```tsx
'use client';

import { useSocket } from '@/hooks/useSocket/useSocket';

export function ManualConnect() {
  const { status, connected, connect, disconnect } = useSocket({
    url: 'https://your-socket-server.com',
    autoConnect: false,
  });

  return (
    <div>
      <div>{status}</div>
      <button onClick={connect} disabled={connected}>
        连接
      </button>
      <button onClick={disconnect} disabled={!connected}>
        断开
      </button>
    </div>
  );
}
```

---

## ACK 调用示例（emitWithAck）

```tsx
const { emitWithAck } = useSocket({
  url: "https://your-socket-server.com",
  ackTimeout: 8000,
});

const handleSave = async () => {
  const result = await emitWithAck<"save">("save", { id: 1 });
  console.log(result);
};
```

---

## 浏览器 extraHeaders 限制（重要）

`extraHeaders` 会被注入到 `transportOptions.polling/websocket.extraHeaders`。

- 在 **浏览器** 中，WebSocket 握手与部分跨域场景通常**不允许**自定义 header（受浏览器安全策略限制）
- 因此浏览器侧更推荐用 **`auth`** 或 **`query`** 传 token/租户信息
- 在 Node / React Native 等环境，是否生效取决于底层 transport 实现

---

## 最佳实践

- **稳定化配置对象**：虽然该 Hook 会基于“连接相关字段”生成稳定 key，只有 key 变化才会重建连接；但建议仍尽量避免每次 render 构造超大的 `ioOptions` 对象。
- **token 变更**：把 token 放到 `auth` 中，当 token 变化时会触发重建连接（因为 key 会变化）。
- **监听与解绑**：使用 `on()` 的返回值在 `useEffect` cleanup 中解绑，避免重复监听。
