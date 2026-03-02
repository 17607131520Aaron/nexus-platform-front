import { useEffect, useMemo, useState } from "react";

import { useSocket } from "@/hooks/useSocket/useSocket";
import { getWsGatewayConfig } from "@/services/ws";

import { DEFAULT_METRO_LOGGER_PATH, DEFAULT_PORT, DEFAULT_RECONNECT_DELAY, DEFAULT_MAX_LOGS } from "./constants";

type LogItem = {
  id: string;
  type: string;
  payload: unknown;
  from?: string;
  createdAt: string;
};

type ServerToClientEvents = Record<string, (...args: unknown[]) => unknown>;

type ClientToServerEvents = Record<string, (...args: unknown[]) => unknown>;

function readClientAuthToken(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const cookies = document.cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === "auth_token") {
      const value = rest.join("=").trim();
      if (value) {
        return decodeURIComponent(value);
      }
    }
  }

  return undefined;
}

const useRnLogs = () => {
  const [port, setPort] = useState<number>(DEFAULT_PORT);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [logs, setLogs] = useState<LogItem[]>([]);

  const { url: socketUrl, path } = useMemo(() => getWsGatewayConfig(), []);
  const authToken = useMemo(() => readClientAuthToken(), []);
  const authConfig = useMemo(
    () => (authToken ? ({ auth: { token: authToken } } as const) : {}),
    [authToken],
  );

  const { status, connected, emit, on, disconnect, reconnectAttempt, connect } = useSocket<
    ServerToClientEvents,
    ClientToServerEvents
  >({
    url: socketUrl,
    path,
    ...authConfig,
    autoConnect: false,
    reconnectionDelay: DEFAULT_RECONNECT_DELAY,
    reconnectionAttempts: 10,
  });

  const isConnecting = status === "connecting" || status === "reconnecting";
  const isConnected = connected;

  useEffect(() => {
    const off = on("message", (rawMessage: unknown) => {
      const message = rawMessage as LogItem;

      setLogs((prev: LogItem[]) => {
        const next: LogItem[] = [...prev, message];
        if (next.length > DEFAULT_MAX_LOGS) {
          return next.slice(next.length - DEFAULT_MAX_LOGS);
        }
        return next;
      });
    });

    return off;
  }, [on]);

  const handleConnectClick = (): void => {
    if (!socketUrl) {
      return;
    }

    connect();

    emit("message:publish", {
      type: "rn-logs-connect",
      payload: {
        note: "RN Logs 页面尝试连接 WebSocket 消息中心",
        port,
        path: DEFAULT_METRO_LOGGER_PATH,
      },
      from: "rn-logs-page",
    });
  };

  const handleClose = (): void => {
    disconnect();
  };

  const handleClearLogs = (): void => {
    setLogs([]);
  };

  const filteredLogs = logs; // 后续可以基于 levelFilter / searchText 做过滤

  return {
    isConnecting,
    isConnected,
    port,
    setPort,
    handleConnectClick,
    handleClose,
    handleClearLogs,
    levelFilter,
    setLevelFilter,
    searchText,
    setSearchText,
    filteredLogs,
    reconnectAttempt,
  };
};

export default useRnLogs;
