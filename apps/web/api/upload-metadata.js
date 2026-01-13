import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "metadata";
const SUPABASE_FOLDER = process.env.SUPABASE_FOLDER || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "xwing_items";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function sanitizeFileName(input) {
  if (!input) {
    return "";
  }
  let name = String(input).trim();
  if (!name) {
    return "";
  }
  if (/^https?:\/\//i.test(name)) {
    try {
      name = new URL(name).pathname.split("/").pop() || "";
    } catch (err) {
      name = "";
    }
  }
  name = name.split(/[\\/]/).pop() || "";
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe) {
    return "";
  }
  return safe.endsWith(".json") ? safe : `${safe}.json`;
}

function sanitizeFolder(input) {
  if (!input) {
    return "";
  }
  const parts = String(input)
    .split(/[\\/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .filter(Boolean);
  return parts.join("/");
}

function buildPath(fileName, folder) {
  if (!folder) {
    return fileName;
  }
  return `${folder}/${fileName}`;
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
  if (!SUPABASE_BUCKET) {
    sendJson(res, 500, { error: "Supabase bucket missing" });
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

    const metadata = body?.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      sendJson(res, 400, { error: "metadata is required" });
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { count, error: countError } = await supabase
      .from(SUPABASE_TABLE)
      .select("id", { count: "exact", head: true });
    if (countError) {
      sendJson(res, 500, { error: countError.message || "Database count failed" });
      return;
    }

    const xwingNumber = (count ?? 0) + 1;
    const itemId = `xwing${xwingNumber}`;
    const storedMetadata = {
      ...metadata,
      name: itemId,
      trace: {
        ...(metadata.trace && typeof metadata.trace === "object" ? metadata.trace : {}),
        item_id: itemId,
        sequence: xwingNumber,
      },
    };

    const safeFileName = `${itemId}.json`;
    const clientFolder = sanitizeFolder(body?.folder);
    const baseFolder = sanitizeFolder(SUPABASE_FOLDER);
    const fullFolder = [baseFolder, clientFolder].filter(Boolean).join("/");
    const path = buildPath(safeFileName, fullFolder);

    const content = JSON.stringify(storedMetadata, null, 2);

    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, Buffer.from(content), { upsert: false, contentType: "application/json" });
    if (error) {
      sendJson(res, 500, { error: error.message || "Upload failed" });
      return;
    }
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl || "";
    const { error: insertError } = await supabase.from(SUPABASE_TABLE).insert({
      item_id: itemId,
      name: itemId,
      metadata_path: path,
      metadata_url: publicUrl,
      metadata_json: storedMetadata,
    });
    if (insertError) {
      sendJson(res, 500, { error: insertError.message || "Database insert failed" });
      return;
    }
    sendJson(res, 200, {
      publicUrl,
      path,
      itemId,
      name: itemId,
      fileName: safeFileName,
      metadata: storedMetadata,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Upload failed" });
  }
}
