import { Server as SocketIOServer, type Socket as IOSocket } from "socket.io";

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
    const io = new SocketIOServer(res.socket.server, {
      path: "/api/ws/socket",
      cors: {
        origin: "*",
      },
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
          if (!input || typeof input.type !== "string" || input.type.trim() === "") {
            return;
          }
          const message = buildMessage(input);
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

