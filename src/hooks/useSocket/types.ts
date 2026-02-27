import type { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';

export type SocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export type AnyFn = (...args: unknown[]) => unknown;

export type ClientToServerEvents = Record<string, AnyFn>;
export type ServerToClientEvents = Record<string, AnyFn>;

export type SocketExtraHeaders = Record<string, string>;

export type UseSocketIoOptions = Partial<ManagerOptions & SocketOptions>;

export type UseSocketConfig<
  ListenEvents extends ServerToClientEvents = ServerToClientEvents,
  EmitEvents extends ClientToServerEvents = ClientToServerEvents,
  Auth extends Record<string, unknown> = Record<string, unknown>,
> = {
  url: string;

  enabled?: boolean;
  autoConnect?: boolean;

  /** 连接超时（毫秒）。默认 5000 */
  timeout?: number;
  /** 连接失败/断线重连最大次数。默认 5 */
  reconnectionAttempts?: number;
  /** 重连延迟（毫秒）。默认 1000 */
  reconnectionDelay?: number;

  /**
   * 额外请求头。
   * - 在浏览器环境通常不会真正作为 Header 发送（受限于浏览器/跨域策略）
   * - Node / React Native 场景下可用性取决于底层 transport
   */
  extraHeaders?: SocketExtraHeaders;

  /** 推荐浏览器用 auth 传 token */
  auth?: Auth;
  query?: Record<string, string | number | boolean>;

  path?: string;
  transports?: Array<'websocket' | 'polling'>;
  withCredentials?: boolean;

  forceNew?: boolean;
  multiplex?: boolean;

  /** 兜底透传给 socket.io-client 的原生选项 */
  ioOptions?: UseSocketIoOptions;

  onConnect?: (socket: Socket<ListenEvents, EmitEvents>) => void;
  onDisconnect?: (
    reason: string,
    socket: Socket<ListenEvents, EmitEvents>,
  ) => void;
  onError?: (error: Error) => void;
  onReconnectAttempt?: (attempt: number) => void;
  onReconnectFailed?: () => void;
  onReconnect?: (attempt: number) => void;
};

export type UseSocketResult<
  ListenEvents extends ServerToClientEvents = ServerToClientEvents,
  EmitEvents extends ClientToServerEvents = ClientToServerEvents,
> = {
  socket: Socket<ListenEvents, EmitEvents> | null;
  status: SocketStatus;
  connected: boolean;
  id: string | undefined;
  error: Error | null;
  reconnectAttempt: number;

  connect: () => void;
  disconnect: () => void;

  emit: <E extends Extract<keyof EmitEvents, string>>(
    event: E,
    ...args: Parameters<EmitEvents[E]>
  ) => void;

  on: <E extends Extract<keyof ListenEvents, string>>(
    event: E,
    listener: ListenEvents[E],
  ) => () => void;

  off: <E extends Extract<keyof ListenEvents, string>>(
    event: E,
    listener?: ListenEvents[E],
  ) => void;
};
