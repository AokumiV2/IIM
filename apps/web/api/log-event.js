import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_EVENTS_TABLE = process.env.SUPABASE_EVENTS_TABLE || "xwing_events";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function formatError(err) {
  if (!err) {
    return { message: "Unknown error" };
  }
  const info = { message: err.message || String(err) };
  if (err.cause && typeof err.cause === "object") {
    info.cause = {
      message: err.cause.message || String(err.cause),
      code: err.cause.code,
    };
  }
  return info;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 500, { error: "Supabase server config missing" });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (err) {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return;
      }
    }

    const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : "";
    const eventType = typeof body?.eventType === "string" ? body.eventType.trim() : "";
    const payloadHash = typeof body?.payloadHash === "string" ? body.payloadHash.trim() : "";
    const payload = body?.payload && typeof body.payload === "object" ? body.payload : null;
    const txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";

    if (!itemId || !eventType || !payloadHash) {
      sendJson(res, 400, { error: "itemId, eventType, and payloadHash are required" });
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let insertResult;
    try {
      insertResult = await supabase.from(SUPABASE_EVENTS_TABLE).insert({
        item_id: itemId,
        event_type: eventType,
        payload_hash: payloadHash,
        payload_json: payload,
        tx_hash: txHash || null,
        metadata_url: payload?.metadata_url || null,
      });
    } catch (err) {
      sendJson(res, 500, {
        error: "Event insert request failed",
        detail: formatError(err),
      });
      return;
    }

    const { error } = insertResult;
    if (error) {
      sendJson(res, 500, { error: error.message || "Event insert failed" });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Event logging failed" });
  }
}
