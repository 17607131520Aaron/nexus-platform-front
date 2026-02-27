import type {
  ClientToServerEvents,
  ServerToClientEvents,
  UseSocketConfig,
  UseSocketIoOptions,
} from './types';

export const DEFAULT_RECONNECTION_ATTEMPTS = 5;
export const DEFAULT_RECONNECTION_DELAY = 1000;
export const DEFAULT_TIMEOUT = 5000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

export function stableSerialize(value: unknown): string {
  const seen = new WeakSet<object>();

  const walk = (v: unknown): unknown => {
    if (v === null) {
      return null;
    }
    if (typeof v === 'undefined') {
      return '__undefined__';
    }
    if (typeof v === 'bigint') {
      return v.toString();
    }
    if (typeof v === 'function') {
      return '__function__';
    }
    if (typeof v !== 'object') {
      return v;
    }

    if (seen.has(v as object)) {
      return '__circular__';
    }
    seen.add(v as object);

    if (Array.isArray(v)) {
      return v.map(walk);
    }

    if (isPlainObject(v)) {
      const obj = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(obj).sort()) {
        out[key] = walk(obj[key]);
      }
      return out;
    }

    return Object.prototype.toString.call(v);
  };

  return JSON.stringify(walk(value));
}

type SocketKeyShape = {
  url: string;
  enabled: boolean;
  autoConnect: boolean;
  timeout: number;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  path?: string;
  transports?: Array<'websocket' | 'polling'>;
  withCredentials?: boolean;
  forceNew?: boolean;
  multiplex?: boolean;
  auth?: unknown;
  query?: Record<string, string | number | boolean>;
  extraHeaders?: Record<string, string>;
  ioOptions?: UseSocketIoOptions;
};

function assignIfDefined<T extends Record<string, unknown>, K extends string>(
  target: T,
  key: K,
  value: unknown,
): void {
  if (typeof value !== 'undefined') {
    (target as Record<string, unknown>)[key] = value;
  }
}

export function createSocketKey<
  ListenEvents extends ServerToClientEvents = ServerToClientEvents,
  EmitEvents extends ClientToServerEvents = ClientToServerEvents,
  Auth extends Record<string, unknown> = Record<string, unknown>,
>(config: UseSocketConfig<ListenEvents, EmitEvents, Auth>): string {
  const shape: SocketKeyShape = {
    url: config.url,
    enabled: config.enabled ?? true,
    autoConnect: config.autoConnect ?? true,
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    reconnectionAttempts:
      config.reconnectionAttempts ?? DEFAULT_RECONNECTION_ATTEMPTS,
    reconnectionDelay: config.reconnectionDelay ?? DEFAULT_RECONNECTION_DELAY,
  };

  assignIfDefined(shape, 'path', config.path);
  assignIfDefined(shape, 'transports', config.transports);
  assignIfDefined(shape, 'withCredentials', config.withCredentials);
  assignIfDefined(shape, 'forceNew', config.forceNew);
  assignIfDefined(shape, 'multiplex', config.multiplex);
  assignIfDefined(shape, 'auth', config.auth);
  assignIfDefined(shape, 'query', config.query);
  assignIfDefined(shape, 'extraHeaders', config.extraHeaders);
  assignIfDefined(shape, 'ioOptions', config.ioOptions);

  return stableSerialize(shape);
}

function mergeTransportOptions(
  base: UseSocketIoOptions['transportOptions'],
  next: UseSocketIoOptions['transportOptions'],
): Record<string, unknown> {
  const a = (base ?? {}) as Record<string, unknown>;
  const b = (next ?? {}) as Record<string, unknown>;
  return { ...a, ...b };
}

function normalizeQuery(
  query: Record<string, string | number | boolean> | undefined,
): Record<string, string> | undefined {
  if (!query) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    out[k] = String(v);
  }
  return out;
}

export function buildIoOptions<
  ListenEvents extends ServerToClientEvents = ServerToClientEvents,
  EmitEvents extends ClientToServerEvents = ClientToServerEvents,
  Auth extends Record<string, unknown> = Record<string, unknown>,
>(config: UseSocketConfig<ListenEvents, EmitEvents, Auth>): UseSocketIoOptions {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const reconnectionAttempts =
    config.reconnectionAttempts ?? DEFAULT_RECONNECTION_ATTEMPTS;
  const reconnectionDelay =
    config.reconnectionDelay ?? DEFAULT_RECONNECTION_DELAY;

  const base: UseSocketIoOptions = {};
  base.autoConnect = (config.autoConnect ?? true) && (config.enabled ?? true);
  base.timeout = timeout;
  base.reconnection = true;
  base.reconnectionAttempts = reconnectionAttempts;
  base.reconnectionDelay = reconnectionDelay;

  if (typeof config.path !== 'undefined') {
    base.path = config.path;
  }
  if (typeof config.transports !== 'undefined') {
    base.transports = config.transports;
  }
  if (typeof config.withCredentials !== 'undefined') {
    base.withCredentials = config.withCredentials;
  }
  if (typeof config.forceNew !== 'undefined') {
    base.forceNew = config.forceNew;
  }
  if (typeof config.multiplex !== 'undefined') {
    base.multiplex = config.multiplex;
  }
  if (typeof config.auth !== 'undefined') {
    base.auth = config.auth;
  }

  const normalizedQuery = normalizeQuery(config.query);
  if (typeof normalizedQuery !== 'undefined') {
    base.query = normalizedQuery;
  }

  const merged: UseSocketIoOptions = {
    ...base,
    ...(config.ioOptions ?? {}),
    transportOptions: mergeTransportOptions(
      base.transportOptions,
      config.ioOptions?.transportOptions,
    ),
  };

  if (config.extraHeaders && Object.keys(config.extraHeaders).length > 0) {
    const current = (merged.transportOptions ?? {}) as Record<string, unknown>;
    const polling = (current['polling'] ?? {}) as Record<string, unknown>;
    const websocket = (current['websocket'] ?? {}) as Record<string, unknown>;
    const pollingExtra = (polling['extraHeaders'] ?? {}) as Record<string, string>;
    const websocketExtra = (websocket['extraHeaders'] ?? {}) as Record<
      string,
      string
    >;

    merged.transportOptions = {
      ...current,
      polling: { ...polling, extraHeaders: { ...pollingExtra, ...config.extraHeaders } },
      websocket: {
        ...websocket,
        extraHeaders: { ...websocketExtra, ...config.extraHeaders },
      },
    };
  }

  return merged;
}
