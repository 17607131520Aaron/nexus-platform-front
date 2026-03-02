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
  /** 是否启用自动重连。默认 true */
  reconnection?: boolean;

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

  /** 默认 ACK 超时时间（毫秒）。emitWithAck 未传 timeout 时使用，默认 10000 */
  ackTimeout?: number;
  /** 是否启用离线发送队列（默认 true） */
  offlineQueue?: boolean;
  /** 离线队列最大长度（默认 100，超过后丢弃最早消息） */
  maxOfflineQueueSize?: number;
  /**
   * 连接鉴权失败时的自动刷新函数。
   * - 返回新的 auth 对象会自动注入并触发重连
   * - 返回 null/undefined 视为刷新失败
   */
  refreshAuth?: () => Promise<Auth | null | undefined>;
  /** 判断 connect_error 是否属于鉴权错误，默认匹配 unauthorized/forbidden/401/403 */
  isAuthError?: (error: Error) => boolean;
  /** 鉴权刷新失败回调 */
  onAuthRefreshFailed?: (error: Error) => void;
  /** 离线队列消息被成功发送后触发 */
  onQueueDrain?: (drainedCount: number) => void;

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
  emitWithAck: <E extends Extract<keyof EmitEvents, string>, Ack = unknown>(
    event: E,
    ...args: Parameters<EmitEvents[E]>
  ) => Promise<Ack>;

  on: <E extends Extract<keyof ListenEvents, string>>(
    event: E,
    listener: ListenEvents[E],
  ) => () => void;

  off: <E extends Extract<keyof ListenEvents, string>>(
    event: E,
    listener?: ListenEvents[E],
  ) => void;
};
