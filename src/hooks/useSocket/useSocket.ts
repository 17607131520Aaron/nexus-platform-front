"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketStatus,
  UseSocketConfig,
  UseSocketResult,
} from "./types";
import { buildIoOptions, createSocketKey } from "./utils";

function normalizeError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === "string") {
    return new Error(err);
  }
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error(String(err));
  }
}

export function useSocket<
  ListenEvents extends ServerToClientEvents = ServerToClientEvents,
  EmitEvents extends ClientToServerEvents = ClientToServerEvents,
  Auth extends Record<string, unknown> = Record<string, unknown>,
>(config: UseSocketConfig<ListenEvents, EmitEvents, Auth>): UseSocketResult<ListenEvents, EmitEvents> {
  const enabled = config.enabled ?? true;
  const autoConnect = config.autoConnect ?? true;

  const socketKey = useMemo(() => createSocketKey(config), [config]);

  const socketRef = useRef<Socket<ListenEvents, EmitEvents> | null>(null);
  const socketKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  const [status, setStatus] = useState<SocketStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const callbacksRef = useRef({
    onConnect: config.onConnect,
    onDisconnect: config.onDisconnect,
    onError: config.onError,
    onReconnectAttempt: config.onReconnectAttempt,
    onReconnectFailed: config.onReconnectFailed,
    onReconnect: config.onReconnect,
  });

  useEffect(() => {
    callbacksRef.current = {
      onConnect: config.onConnect,
      onDisconnect: config.onDisconnect,
      onError: config.onError,
      onReconnectAttempt: config.onReconnectAttempt,
      onReconnectFailed: config.onReconnectFailed,
      onReconnect: config.onReconnect,
    };
  }, [
    config.onConnect,
    config.onDisconnect,
    config.onError,
    config.onReconnectAttempt,
    config.onReconnectFailed,
    config.onReconnect,
  ]);

  const safeSetStatus = useCallback((next: SocketStatus): void => {
    if (!mountedRef.current) {
      return;
    }
    setStatus(next);
  }, []);

  const safeSetError = useCallback((next: Error | null): void => {
    if (!mountedRef.current) {
      return;
    }
    setError(next);
  }, []);

  const safeSetReconnectAttempt = useCallback((attempt: number): void => {
    if (!mountedRef.current) {
      return;
    }
    setReconnectAttempt(attempt);
  }, []);

  const cleanupSocket = useCallback((): void => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    try {
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
      socket.close();
    } catch {
      // ignore cleanup errors
    }

    socketRef.current = null;
    socketKeyRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanupSocket();
      safeSetError(null);
      safeSetReconnectAttempt(0);
      safeSetStatus("idle");
      return;
    }

    const shouldRecreate = !socketRef.current || socketKeyRef.current !== socketKey;
    if (!shouldRecreate) {
      return;
    }

    cleanupSocket();

    const options: Partial<ManagerOptions & SocketOptions> = buildIoOptions(config);
    const socket = io(config.url, options) as Socket<ListenEvents, EmitEvents>;
    socketRef.current = socket;
    socketKeyRef.current = socketKey;

    safeSetError(null);
    safeSetReconnectAttempt(0);
    safeSetStatus(autoConnect ? "connecting" : "idle");

    const onConnect = (): void => {
      safeSetError(null);
      safeSetReconnectAttempt(0);
      safeSetStatus("connected");
      callbacksRef.current.onConnect?.(socket);
    };

    const onDisconnect = (reason: string): void => {
      // socket.io 会在需要时触发 reconnect_* 事件，这里先标记为 disconnected
      safeSetStatus("disconnected");
      callbacksRef.current.onDisconnect?.(reason, socket);
    };

    const onConnectError = (err: unknown): void => {
      const e = normalizeError(err);
      safeSetError(e);
      callbacksRef.current.onError?.(e);
      // 如果启用了自动重连，状态更贴近“正在重试”
      safeSetStatus(socket.io.opts.reconnection ? "reconnecting" : "error");
    };

    const onReconnectAttempt = (attempt: number): void => {
      safeSetReconnectAttempt(attempt);
      safeSetStatus("reconnecting");
      callbacksRef.current.onReconnectAttempt?.(attempt);
    };

    const onReconnect = (attempt: number): void => {
      safeSetError(null);
      safeSetReconnectAttempt(attempt);
      safeSetStatus("connected");
      callbacksRef.current.onReconnect?.(attempt);
    };

    const onReconnectError = (err: unknown): void => {
      const e = normalizeError(err);
      safeSetError(e);
      callbacksRef.current.onError?.(e);
      safeSetStatus("reconnecting");
    };

    const onReconnectFailed = (): void => {
      safeSetStatus("error");
      callbacksRef.current.onReconnectFailed?.();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);
    socket.io.on("reconnect_error", onReconnectError);
    socket.io.on("reconnect_failed", onReconnectFailed);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
      socket.io.off("reconnect_error", onReconnectError);
      socket.io.off("reconnect_failed", onReconnectFailed);
      cleanupSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, socketKey, autoConnect, cleanupSocket, safeSetError, safeSetReconnectAttempt, safeSetStatus]);

  const connect = useCallback((): void => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    safeSetStatus("connecting");
    socket.connect();
  }, [safeSetStatus]);

  const disconnect = useCallback((): void => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    socket.disconnect();
    safeSetStatus("disconnected");
  }, [safeSetStatus]);

  const emit = useCallback(
    <E extends Extract<keyof EmitEvents, string>>(
      event: E,
      ...args: Parameters<EmitEvents[E]>
    ): void => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    socket.emit(event, ...args);
    },
    [],
  );

  const on = useCallback(
    <E extends Extract<keyof ListenEvents, string>>(
      event: E,
      listener: ListenEvents[E],
    ): (() => void) => {
    const socket = socketRef.current;
    if (!socket) {
      return () => undefined;
    }
      socket.on(event as unknown as never, listener as unknown as never);
    return () => {
        socket.off(event as unknown as never, listener as unknown as never);
    };
    },
    [],
  );

  const off = useCallback(
    <E extends Extract<keyof ListenEvents, string>>(
      event: E,
      listener?: ListenEvents[E],
    ): void => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    if (listener) {
        socket.off(event as unknown as never, listener as unknown as never);
    } else {
        socket.off(event as unknown as never);
    }
    },
    [],
  );

  const socket = socketRef.current;

  return {
    socket,
    status,
    connected: socket?.connected ?? false,
    id: socket?.id,
    error,
    reconnectAttempt,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}
