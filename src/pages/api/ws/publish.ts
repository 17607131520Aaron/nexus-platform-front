import type { NextApiResponseWithSocket, PublishMessageInput } from "./socket";
import {
  buildMessage,
  checkRateLimit,
  getGatewaySecurityConfig,
  getOrCreateIo,
  isRequestAuthorized,
  isRequestOriginAllowed,
  validatePublishMessageInput,
} from "./socket";

import type { NextApiRequest } from "next";

type ApiResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

const handler = async (req: NextApiRequest, res: NextApiResponseWithSocket): Promise<void> => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  if (!isRequestOriginAllowed(req)) {
    res.status(403).json({ ok: false, error: "Origin not allowed" });
    return;
  }

  if (!isRequestAuthorized(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  try {
    const input = req.body as PublishMessageInput | undefined;
    const config = getGatewaySecurityConfig();
    const rateLimitKey = `http:${req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown"}`;

    if (!checkRateLimit(rateLimitKey, config)) {
      res.status(429).json({ ok: false, error: "Too Many Requests" });
      return;
    }

    const validated = validatePublishMessageInput(input, config);
    if (!validated.ok) {
      res.status(400).json({ ok: false, error: validated.reason });
      return;
    }

    const io = getOrCreateIo(res);
    const message = buildMessage(validated.value);

    io.emit("message", message);

    const response: ApiResponse = { ok: true };
    res.status(200).json(response);
  } catch (error) {
    const response: ApiResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    };
    res.status(500).json(response);
  }
};

export default handler;
