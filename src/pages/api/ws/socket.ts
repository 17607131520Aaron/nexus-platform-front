import { Server as SocketIOServer, type Socket as IOSocket } from "socket.io";

import { AUTH_TOKEN_KEY } from "@/lib/auth";

import type { Server as HTTPServer } from "http";
import type { Socket } from "net";
import type { NextApiRequest, NextApiResponse } from "next";

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer & {
      io?: SocketIOServer;
    };
  };
};

// 统一的消息信封结构，只做收/发，不夹杂业务含义
export type WsEnvelope<T = unknown> = {
  id: string;
  type: string;
  // 使用 exactOptionalPropertyTypes 时，需要把可选属性类型显式包含 undefined
  payload?: T | undefined;
  from?: string | undefined;
  createdAt: string;
};

// 外部调用（WS 或 HTTP）发送时的入参
export type PublishMessageInput<T = unknown> = {
  type: string;
  payload?: T;
  from?: string;
};

const DEFAULT_MAX_PAYLOAD_BYTES = 16 * 1024;
const DEFAULT_RATE_LIMIT_MAX = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MESSAGE_TYPE_PATTERN = /^[a-zA-Z0-9._:-]{1,64}$/;
const RESERVED_MESSAGE_TYPES = new Set(["system"]);

type WsGatewaySecurityConfig = {
  authRequired: boolean;
  tokenSet: Set<string>;
  allowedOrigins: Set<string>;
  allowedMessageTypes: Set<string>;
  maxPayloadBytes: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const publishRateMap = new Map<string, RateBucket>();

function parseCsvSet(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set<string>();
  }

  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function parseEnvNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return fallback;
}

function getTokenSetFromEnv(): Set<string> {
  const tokens = parseCsvSet(process.env["WS_AUTH_TOKENS"]);
  const singleToken = process.env["WS_AUTH_TOKEN"]?.trim();
  if (singleToken) {
    tokens.add(singleToken);
  }
  return tokens;
}

function buildGatewaySecurityConfig(): WsGatewaySecurityConfig {
  const tokenSet = getTokenSetFromEnv();
  const isProd = process.env["NODE_ENV"] === "production";

  return {
    authRequired: parseBool(process.env["WS_AUTH_REQUIRED"], isProd),
    tokenSet,
    allowedOrigins: parseCsvSet(process.env["WS_ALLOWED_ORIGINS"]),
    allowedMessageTypes: parseCsvSet(process.env["WS_ALLOWED_MESSAGE_TYPES"]),
    maxPayloadBytes: parseEnvNumber(
      process.env["WS_MAX_PAYLOAD_BYTES"],
      DEFAULT_MAX_PAYLOAD_BYTES,
    ),
    rateLimitMax: parseEnvNumber(process.env["WS_RATE_LIMIT_MAX"], DEFAULT_RATE_LIMIT_MAX),
    rateLimitWindowMs: parseEnvNumber(
      process.env["WS_RATE_LIMIT_WINDOW_MS"],
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
  };
}

const gatewaySecurityConfig = buildGatewaySecurityConfig();

function parseCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === AUTH_TOKEN_KEY) {
      const raw = rest.join("=");
      return raw ? decodeURIComponent(raw) : null;
    }
  }
  return null;
}

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }
  const [scheme, value] = authorization.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return null;
  }
  return value;
}

function validateToken(token: string | null, config: WsGatewaySecurityConfig): boolean {
  if (!config.authRequired) {
    return true;
  }
  if (!token) {
    return false;
  }
  if (config.tokenSet.size === 0) {
    return token.trim().length > 0;
  }
  return config.tokenSet.has(token);
}

function isOriginAllowed(origin: string | undefined, config: WsGatewaySecurityConfig): boolean {
  if (config.allowedOrigins.size === 0) {
    return true;
  }
  if (!origin) {
    return false;
  }
  return config.allowedOrigins.has(origin);
}

function getPayloadSizeBytes(payload: unknown): number {
  if (typeof payload === "undefined") {
    return 0;
  }
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function cleanupExpiredBuckets(now: number): void {
  if (publishRateMap.size < 1000) {
    return;
  }

  for (const [key, bucket] of publishRateMap.entries()) {
    if (bucket.resetAt <= now) {
      publishRateMap.delete(key);
    }
  }
}

export function checkRateLimit(key: string, config: WsGatewaySecurityConfig): boolean {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const bucket = publishRateMap.get(key);
  if (!bucket || bucket.resetAt <= now) {
    publishRateMap.set(key, {
      count: 1,
      resetAt: now + config.rateLimitWindowMs,
    });
    return true;
  }

  if (bucket.count >= config.rateLimitMax) {
    return false;
  }

  bucket.count += 1;
  return true;
}

function isAllowedMessageType(type: string, config: WsGatewaySecurityConfig): boolean {
  if (config.allowedMessageTypes.size === 0) {
    return true;
  }
  return config.allowedMessageTypes.has(type);
}

type PublishValidationResult =
  | {
      ok: true;
      value: PublishMessageInput;
    }
  | {
      ok: false;
      reason: string;
    };

export function validatePublishMessageInput(
  input: PublishMessageInput | undefined,
  config: WsGatewaySecurityConfig = gatewaySecurityConfig,
): PublishValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "Invalid message payload" };
  }

  const rawType = typeof input.type === "string" ? input.type.trim() : "";
  if (!MESSAGE_TYPE_PATTERN.test(rawType)) {
    return { ok: false, reason: "Invalid field `type`" };
  }
  if (RESERVED_MESSAGE_TYPES.has(rawType)) {
    return { ok: false, reason: "`system` is a reserved message type" };
  }
  if (!isAllowedMessageType(rawType, config)) {
    return { ok: false, reason: "Message type is not allowed" };
  }

  const payloadSize = getPayloadSizeBytes(input.payload);
  if (payloadSize > config.maxPayloadBytes) {
    return {
      ok: false,
      reason: `Payload exceeds ${config.maxPayloadBytes} bytes`,
    };
  }

  if (typeof input.from !== "undefined" && typeof input.from !== "string") {
    return { ok: false, reason: "Invalid field `from`" };
  }

  const from = input.from?.trim();
  if (from && from.length > 64) {
    return { ok: false, reason: "Field `from` is too long" };
  }

  const sanitized: PublishMessageInput = {
    type: rawType,
    payload: input.payload,
  };
  if (from) {
    sanitized.from = from;
  }

  return {
    ok: true,
    value: sanitized,
  };
}

export function getGatewaySecurityConfig(): WsGatewaySecurityConfig {
  return gatewaySecurityConfig;
}

export function getRequestToken(req: NextApiRequest): string | null {
  const fromHeader = extractBearerToken(req.headers.authorization);
  if (fromHeader) {
    return fromHeader;
  }

  const fromCustomHeader = req.headers["x-auth-token"];
  if (typeof fromCustomHeader === "string" && fromCustomHeader.trim().length > 0) {
    return fromCustomHeader.trim();
  }

  const fromCookie = req.cookies[AUTH_TOKEN_KEY];
  if (fromCookie && fromCookie.trim().length > 0) {
    return fromCookie.trim();
  }

  return parseCookieToken(req.headers.cookie);
}

export function isRequestAuthorized(req: NextApiRequest): boolean {
  const config = getGatewaySecurityConfig();
  const token = getRequestToken(req);
  return validateToken(token, config);
}

export function isRequestOriginAllowed(req: NextApiRequest): boolean {
  const config = getGatewaySecurityConfig();
  const originHeader = req.headers.origin;
  const origin = typeof originHeader === "string" ? originHeader : undefined;
  return isOriginAllowed(origin, config);
}

export function buildMessage<T = unknown>(input: PublishMessageInput<T>): WsEnvelope<T> {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: input.type,
    payload: input.payload,
    from: input.from,
    createdAt: new Date().toISOString(),
  };
}

export function getOrCreateIo(res: NextApiResponseWithSocket): SocketIOServer {
  if (!res.socket.server.io) {
    const config = getGatewaySecurityConfig();
    const io = new SocketIOServer(res.socket.server, {
      path: "/api/ws/socket",
      cors: {
        origin: config.allowedOrigins.size === 0 ? true : Array.from(config.allowedOrigins),
      },
    });

    io.use((socket, next) => {
      const originHeader = socket.handshake.headers.origin;
      const origin = typeof originHeader === "string" ? originHeader : undefined;
      if (!isOriginAllowed(origin, config)) {
        next(new Error("Origin not allowed"));
        return;
      }

      const authToken =
        (typeof socket.handshake.auth["token"] === "string" && socket.handshake.auth["token"]) ||
        extractBearerToken(
          typeof socket.handshake.headers.authorization === "string"
            ? socket.handshake.headers.authorization
            : undefined,
        ) ||
        (typeof socket.handshake.headers["x-auth-token"] === "string"
          ? socket.handshake.headers["x-auth-token"]
          : null) ||
        parseCookieToken(
          typeof socket.handshake.headers.cookie === "string"
            ? socket.handshake.headers.cookie
            : undefined,
        );

      if (!validateToken(authToken, config)) {
        next(new Error("Unauthorized"));
        return;
      }

      next();
    });

    io.on("connection", (socket: IOSocket) => {
      // 所有客户端统一收 "message" 事件，网关只负责转发
      socket.emit(
        "message",
        buildMessage({
          type: "system",
          payload: {
            message: "已连接到 WebSocket 消息中心",
          },
          from: "ws-gateway",
        }),
      );

      // 只负责接收客户端发来的消息，并广播给所有订阅方
      socket.on("message:publish", (input: PublishMessageInput | undefined) => {
        try {
          const allowed = checkRateLimit(`socket:${socket.id}`, config);
          if (!allowed) {
            return;
          }

          const validated = validatePublishMessageInput(input, config);
          if (!validated.ok) {
            return;
          }

          const message = buildMessage(validated.value);
          io.emit("message", message);
        } catch {
          // 网关层不抛错，只保证通道稳定
        }
      });
    });

    res.socket.server.io = io;
  }

  return res.socket.server.io;
}

const handler = (_req: NextApiRequest, res: NextApiResponseWithSocket): void => {
  // 仅确保 Socket.IO 网关已初始化，不做业务处理
  getOrCreateIo(res);
  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;
