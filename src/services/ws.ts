// WebSocket 网关的 Socket.IO 连接路径（需要与 src/pages/api/ws/socket.ts 中的 path 保持一致）
export const WS_GATEWAY_PATH = "/api/ws/socket";

// 对外 HTTP 发布接口路径（需要与 src/pages/api/ws/publish.ts 保持一致）
export const WS_PUBLISH_PATH = "/api/ws/publish";

// 业务侧对外发送消息时使用的入参结构（HTTP/WS 双方都可以复用）
export type WsPublishInput<T = unknown> = {
  // 业务自定义的消息类型，例如："server-log" / "js-log" / "network-request" 等
  type: string;
  // 实际业务负载内容，保持泛型，方便不同场景复用
  payload?: T;
  // 消息来源标记（哪个系统 / 模块发出的）
  from?: string;
};

// WebSocket 通道中实际流转的“标准消息信封”
// 对应 src/pages/api/ws/socket.ts 中的 WsEnvelope 类型
export type WsMessage<T = unknown> = {
  // 唯一消息 ID，由网关生成
  id: string;
  // 业务自定义的消息类型
  type: string;
  // 业务负载；由于开启了 exactOptionalPropertyTypes，这里显式包含 undefined
  payload?: T | undefined;
  // 来源标记；同样显式包含 undefined
  from?: string | undefined;
  // 消息创建时间（ISO 字符串）
  createdAt: string;
};

// 提供给前端页面 / 客户端使用的工具函数：
// 统一返回连接 WebSocket 网关所需的 url 与 path，避免在各处硬编码。
// 优先级：
// 1）调用方传入的 baseOrigin
// 2）环境变量 NEXT_PUBLIC_WS_ORIGIN（部署时配置）
// 3）本地开发时：通过 NEXT_PUBLIC_WS_ENV / WS_ENV 选择预设环境（默认 test）
// 4）浏览器环境下回退为 window.location.origin
export function getWsGatewayConfig(baseOrigin?: string): { url: string; path: string } {
  let origin = baseOrigin;

  if (!origin && typeof process !== "undefined") {
    const envOrigin = process.env["NEXT_PUBLIC_WS_ORIGIN"];
    if (envOrigin && envOrigin.trim()) {
      origin = envOrigin.trim();
    }
  }

  // 本地开发场景：支持通过 NEXT_PUBLIC_WS_ENV / WS_ENV 切换预设环境
  // 例如：test / preprod / prod
  if (!origin && typeof process !== "undefined") {
    const envKey =
      (process.env["NEXT_PUBLIC_WS_ENV"] ?? process.env["WS_ENV"] ?? "test").trim();

    const presets: Record<string, string> = {
      test: "http://localhost:3001",
      preprod: "https://ws-pre.example.com",
      prod: "https://ws.example.com",
    };

    if (presets[envKey]) {
      origin = presets[envKey];
    }
  }

  // 如果未显式传入 baseOrigin，并且运行在浏览器环境，则默认使用当前站点的 origin
  if (!origin && typeof window !== "undefined") {
    origin = window.location.origin;
  }

  return {
    url: origin ?? "",
    path: WS_GATEWAY_PATH,
  };
}

// 返回 HTTP 发布接口的完整 URL，供前端或其他服务拼接调用
export function getWsPublishUrl(baseOrigin?: string): string {
  let origin = baseOrigin;

  if (!origin && typeof process !== "undefined") {
    const envOrigin = process.env["NEXT_PUBLIC_WS_ORIGIN"];
    if (envOrigin && envOrigin.trim()) {
      origin = envOrigin.trim();
    }
  }

  if (!origin && typeof process !== "undefined") {
    const envKey =
      (process.env["NEXT_PUBLIC_WS_ENV"] ?? process.env["WS_ENV"] ?? "test").trim();

    const presets: Record<string, string> = {
      test: "http://localhost:3001",
      preprod: "https://ws-pre.example.com",
      prod: "https://ws.example.com",
    };

    if (presets[envKey]) {
      origin = presets[envKey];
    }
  }

  // 如果未显式传入 baseOrigin，并且运行在浏览器环境，则默认使用当前站点的 origin
  if (!origin && typeof window !== "undefined") {
    origin = window.location.origin;
  }

  return `${origin ?? ""}${WS_PUBLISH_PATH}`;
}
