import type { NextApiRequest } from "next";
import type { NextApiResponseWithSocket, PublishMessageInput } from "./socket";
import { buildMessage, getOrCreateIo } from "./socket";

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

  try {
    const input = req.body as PublishMessageInput | undefined;

    if (!input || typeof input.type !== "string" || input.type.trim() === "") {
      res.status(400).json({ ok: false, error: "Field `type` is required" });
      return;
    }

    const io = getOrCreateIo(res);
    const message = buildMessage(input);

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

