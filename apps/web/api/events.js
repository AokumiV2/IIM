import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_EVENTS_TABLE = process.env.SUPABASE_EVENTS_TABLE || "xwing_events";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function firstQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    sendJson(res, 500, { error: "Supabase server config missing" });
    return;
  }
  const rawId = firstQueryValue(req.query?.id || req.query?.item_id);
  const itemId = typeof rawId === "string" ? rawId.trim() : "";
  if (!itemId) {
    sendJson(res, 400, { error: "id is required" });
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data, error } = await supabase
      .from(SUPABASE_EVENTS_TABLE)
      .select("id,created_at,item_id,event_type,payload_hash,payload_json,metadata_url,tx_hash")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      sendJson(res, 500, { error: error.message || "Database query failed" });
      return;
    }
    sendJson(res, 200, { events: data || [] });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Events lookup failed" });
  }
}
