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

type SocketListener = (...args: unknown[]) => void;
type QueuedEmitItem = {
  event: string;
  args: unknown[];
  mode: "fire-and-forget" | "ack";
  ackTimeout: number;
  resolve?: (value: unknown) => void;
  reject?: (error: Error) => void;
};

const DEFAULT_ACK_TIMEOUT = 10000;
const DEFAULT_MAX_OFFLINE_QUEUE_SIZE = 100;
const DEFAULT_AUTH_ERROR_PATTERN = /(unauthorized|forbidden|401|403)/i;

function isSocketActive<ListenEvents extends ServerToClientEvents, EmitEvents extends ClientToServerEvents>(
  socket: Socket<ListenEvents, EmitEvents> | null,
): boolean {
  if (!socket) {
    return false;
  }
  return socket.connected || socket.active;
}

function defaultIsAuthError(error: Error): boolean {
  return DEFAULT_AUTH_ERROR_PATTERN.test(error.message);
}

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
  const ackTimeout = config.ackTimeout ?? DEFAULT_ACK_TIMEOUT;
  const offlineQueueEnabled = config.offlineQueue ?? true;
  const maxOfflineQueueSize = config.maxOfflineQueueSize ?? DEFAULT_MAX_OFFLINE_QUEUE_SIZE;
  const isAuthError = config.isAuthError ?? defaultIsAuthError;

  const socketKey = useMemo(() => createSocketKey(config), [config]);

  const socketRef = useRef<Socket<ListenEvents, EmitEvents> | null>(null);
  const socketKeyRef = useRef<string | null>(null);
  const listenersRef = useRef<Map<string, Set<SocketListener>>>(new Map());
  const queueRef = useRef<QueuedEmitItem[]>([]);
  const runtimeAuthRef = useRef<Auth | undefined>(config.auth);
  const authRefreshingRef = useRef(false);
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
    onAuthRefreshFailed: config.onAuthRefreshFailed,
    onQueueDrain: config.onQueueDrain,
  });

  useEffect(() => {
    callbacksRef.current = {
      onConnect: config.onConnect,
      onDisconnect: config.onDisconnect,
      onError: config.onError,
      onReconnectAttempt: config.onReconnectAttempt,
      onReconnectFailed: config.onReconnectFailed,
      onReconnect: config.onReconnect,
      onAuthRefreshFailed: config.onAuthRefreshFailed,
      onQueueDrain: config.onQueueDrain,
    };
  }, [
    config.onConnect,
    config.onDisconnect,
    config.onError,
    config.onReconnectAttempt,
    config.onReconnectFailed,
    config.onReconnect,
    config.onAuthRefreshFailed,
    config.onQueueDrain,
  ]);

  useEffect(() => {
    runtimeAuthRef.current = config.auth;
  }, [config.auth]);

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
      socket.disconnect();
    } catch {
      // ignore cleanup errors
    }

    socketRef.current = null;
    socketKeyRef.current = null;
  }, []);

  const bindRegisteredListeners = useCallback((socket: Socket<ListenEvents, EmitEvents>): void => {
    for (const [event, listeners] of listenersRef.current.entries()) {
      for (const listener of listeners) {
        socket.on(event as unknown as never, listener as unknown as never);
      }
    }
  }, []);

  const emitWithAckRaw = useCallback(
    <Ack>(socket: Socket<ListenEvents, EmitEvents>, event: string, args: unknown[], timeoutMs: number): Promise<Ack> =>
      new Promise<Ack>((resolve, reject) => {
        (socket.timeout(timeoutMs).emit as unknown as (...inner: unknown[]) => void)(
          event,
          ...args,
          (err: Error | null, response: Ack) => {
            if (err) {
              reject(normalizeError(err));
              return;
            }
            resolve(response);
          },
        );
      }),
    [],
  );

  const enqueueEmit = useCallback(
    (item: QueuedEmitItem): void => {
      queueRef.current.push(item);
      if (queueRef.current.length <= maxOfflineQueueSize) {
        return;
      }

      const dropped = queueRef.current.shift();
      if (dropped?.mode === "ack" && dropped.reject) {
        dropped.reject(new Error("Offline queue is full, message dropped"));
      }
    },
    [maxOfflineQueueSize],
  );

  const clearQueue = useCallback((reason: string): void => {
    if (queueRef.current.length === 0) {
      return;
    }
    const pending = queueRef.current.splice(0, queueRef.current.length);
    for (const item of pending) {
      if (item.mode === "ack") {
        item.reject?.(new Error(reason));
      }
    }
  }, []);

  const drainQueue = useCallback(
    async (socket: Socket<ListenEvents, EmitEvents>): Promise<void> => {
      if (!socket.connected || queueRef.current.length === 0) {
        return;
      }

      const pending = queueRef.current.splice(0, queueRef.current.length);
      let drainedCount = 0;

      for (const item of pending) {
        try {
          if (item.mode === "ack") {
            const response = await emitWithAckRaw(socket, item.event, item.args, item.ackTimeout);
            item.resolve?.(response);
          } else {
            (socket.emit as unknown as (...inner: unknown[]) => void)(item.event, ...item.args);
          }
          drainedCount += 1;
        } catch (err) {
          const error = normalizeError(err);
          if (item.mode === "ack") {
            item.reject?.(error);
          } else if (offlineQueueEnabled) {
            enqueueEmit(item);
            break;
          }
        }
      }

      if (drainedCount > 0) {
        callbacksRef.current.onQueueDrain?.(drainedCount);
      }
    },
    [emitWithAckRaw, enqueueEmit, offlineQueueEnabled],
  );

  const tryRefreshAuth = useCallback(
    async (socket: Socket<ListenEvents, EmitEvents>, error: Error): Promise<boolean> => {
      const refreshAuth = config.refreshAuth;
      if (!refreshAuth || !isAuthError(error)) {
        return false;
      }
      if (authRefreshingRef.current) {
        return true;
      }

      authRefreshingRef.current = true;
      safeSetStatus("reconnecting");

      try {
        const nextAuth = await refreshAuth();
        if (!nextAuth) {
          throw new Error("Auth refresh returned empty result");
        }
        runtimeAuthRef.current = nextAuth;
        socket.auth = nextAuth as unknown as Record<string, unknown>;
        socket.connect();
        return true;
      } catch (refreshErr) {
        const normalized = normalizeError(refreshErr);
        safeSetError(normalized);
        callbacksRef.current.onError?.(normalized);
        callbacksRef.current.onAuthRefreshFailed?.(normalized);
        safeSetStatus("error");
        return true;
      } finally {
        authRefreshingRef.current = false;
      }
    },
    [config.refreshAuth, isAuthError, safeSetError, safeSetStatus],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      clearQueue("Socket is unmounted");
      mountedRef.current = false;
    };
  }, [clearQueue]);

  useEffect(() => {
    if (!enabled) {
      cleanupSocket();
      clearQueue("Socket is disabled");
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

    const resolvedConfig: UseSocketConfig<ListenEvents, EmitEvents, Auth> = {
      ...config,
      ...(typeof runtimeAuthRef.current === "undefined"
        ? {}
        : { auth: runtimeAuthRef.current }),
    };
    const options: Partial<ManagerOptions & SocketOptions> = buildIoOptions(resolvedConfig);
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
      void drainQueue(socket);
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
      void tryRefreshAuth(socket, e);
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
      void drainQueue(socket);
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
    bindRegisteredListeners(socket);

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
  }, [
    enabled,
    socketKey,
    autoConnect,
    bindRegisteredListeners,
    clearQueue,
    cleanupSocket,
    drainQueue,
    safeSetError,
    safeSetReconnectAttempt,
    safeSetStatus,
    tryRefreshAuth,
  ]);

  const connect = useCallback((): void => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }
    if (isSocketActive(socket)) {
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
    if (!isSocketActive(socket)) {
      safeSetStatus("disconnected");
      return;
    }
    socket.disconnect();
    safeSetStatus("disconnected");
  }, [safeSetStatus]);

  const emit = useCallback(
    <E extends Extract<keyof EmitEvents, string>>(event: E, ...args: Parameters<EmitEvents[E]>): void => {
      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit(event, ...args);
        return;
      }
      if (!offlineQueueEnabled) {
        return;
      }
      enqueueEmit({
        event,
        args: args as unknown[],
        mode: "fire-and-forget",
        ackTimeout,
      });
    },
    [ackTimeout, enqueueEmit, offlineQueueEnabled],
  );

  const emitWithAck = useCallback(
    <E extends Extract<keyof EmitEvents, string>, Ack = unknown>(
      event: E,
      ...args: Parameters<EmitEvents[E]>
    ): Promise<Ack> => {
      const socket = socketRef.current;
      if (socket?.connected) {
        return emitWithAckRaw<Ack>(socket, event, args as unknown[], ackTimeout);
      }
      if (!offlineQueueEnabled) {
        return Promise.reject(new Error("Socket is not connected"));
      }
      return new Promise<Ack>((resolve, reject) => {
        enqueueEmit({
          event,
          args: args as unknown[],
          mode: "ack",
          ackTimeout,
          resolve: (value: unknown) => resolve(value as Ack),
          reject,
        });
      });
    },
    [ackTimeout, emitWithAckRaw, enqueueEmit, offlineQueueEnabled],
  );

  const on = useCallback(
    <E extends Extract<keyof ListenEvents, string>>(event: E, listener: ListenEvents[E]): (() => void) => {
      const eventKey = event as string;
      const normalizedListener = listener as unknown as SocketListener;
      const currentListeners = listenersRef.current.get(eventKey) ?? new Set<SocketListener>();

      if (!listenersRef.current.has(eventKey)) {
        listenersRef.current.set(eventKey, currentListeners);
      }

      if (!currentListeners.has(normalizedListener)) {
        currentListeners.add(normalizedListener);
        const socket = socketRef.current;
        if (socket) {
          socket.on(event as unknown as never, listener as unknown as never);
        }
      }

      return () => {
        const listeners = listenersRef.current.get(eventKey);
        if (listeners) {
          listeners.delete(normalizedListener);
          if (listeners.size === 0) {
            listenersRef.current.delete(eventKey);
          }
        }
        const socket = socketRef.current;
        if (socket) {
          socket.off(event as unknown as never, listener as unknown as never);
        }
      };
    },
    [],
  );

  const off = useCallback(
    <E extends Extract<keyof ListenEvents, string>>(event: E, listener?: ListenEvents[E]): void => {
      const eventKey = event as string;
      if (listener) {
        const normalizedListener = listener as unknown as SocketListener;
        const listeners = listenersRef.current.get(eventKey);
        if (listeners) {
          listeners.delete(normalizedListener);
          if (listeners.size === 0) {
            listenersRef.current.delete(eventKey);
          }
        }
      } else {
        listenersRef.current.delete(eventKey);
      }

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
    emitWithAck,
    on,
    off,
  };
}
