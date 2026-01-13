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

function sanitizeToken(input) {
  if (!input) {
    return "";
  }
  const cleaned = String(input).trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned;
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
  let supabaseHost = "";
  try {
    supabaseHost = new URL(SUPABASE_URL).hostname;
  } catch (err) {
    sendJson(res, 500, { error: "Supabase URL invalid", detail: formatError(err) });
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
    const itemId = typeof body?.itemId === "string" ? body.itemId.trim() : "";
    if (!itemId) {
      sendJson(res, 400, { error: "itemId is required" });
      return;
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      sendJson(res, 400, { error: "metadata is required" });
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let existingResult;
    try {
      existingResult = await supabase
        .from(SUPABASE_TABLE)
        .select("metadata_json")
        .eq("item_id", itemId)
        .limit(1);
    } catch (err) {
      sendJson(res, 500, {
        error: "Database lookup request failed",
        detail: formatError(err),
        host: supabaseHost,
      });
      return;
    }

    const { data: existingRows, error: existingError } = existingResult;
    if (existingError) {
      sendJson(res, 500, { error: existingError.message || "Database lookup failed", host: supabaseHost });
      return;
    }
    if (!existingRows || existingRows.length === 0) {
      sendJson(res, 404, { error: "Item not found", host: supabaseHost });
      return;
    }

    const previousTrace =
      existingRows[0]?.metadata_json && typeof existingRows[0].metadata_json === "object"
        ? existingRows[0].metadata_json.trace || {}
        : {};

    const storedMetadata = {
      ...metadata,
      name: itemId,
      trace: {
        ...(metadata.trace && typeof metadata.trace === "object" ? metadata.trace : {}),
        item_id: itemId,
      },
    };

    if (previousTrace && typeof previousTrace === "object") {
      if (previousTrace.sequence !== undefined) {
        storedMetadata.trace.sequence = previousTrace.sequence;
      }
      if (previousTrace.created_at && !storedMetadata.trace.created_at) {
        storedMetadata.trace.created_at = previousTrace.created_at;
      }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const version = sanitizeToken(storedMetadata.trace?.version || "");
    const safeFileName = version ? `${itemId}-${version}-${stamp}.json` : `${itemId}-${stamp}.json`;

    const clientFolder = sanitizeFolder(body?.folder);
    const baseFolder = sanitizeFolder(SUPABASE_FOLDER);
    const fullFolder = [baseFolder, clientFolder, itemId].filter(Boolean).join("/");
    const path = buildPath(safeFileName, fullFolder);

    const content = JSON.stringify(storedMetadata, null, 2);

    let uploadResult;
    try {
      uploadResult = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(path, Buffer.from(content), { upsert: false, contentType: "application/json" });
    } catch (err) {
      sendJson(res, 500, {
        error: "Storage upload request failed",
        detail: formatError(err),
        host: supabaseHost,
      });
      return;
    }

    const { error: uploadError } = uploadResult;
    if (uploadError) {
      sendJson(res, 500, {
        error: uploadError.message || "Upload failed",
        host: supabaseHost,
      });
      return;
    }

    const { data: publicData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
    const publicUrl = publicData?.publicUrl || "";

    let updateResult;
    try {
      updateResult = await supabase
        .from(SUPABASE_TABLE)
        .update({
          metadata_path: path,
          metadata_url: publicUrl,
          metadata_json: storedMetadata,
        })
        .eq("item_id", itemId);
    } catch (err) {
      sendJson(res, 500, {
        error: "Database update request failed",
        detail: formatError(err),
        host: supabaseHost,
      });
      return;
    }

    const { error: updateError } = updateResult;
    if (updateError) {
      sendJson(res, 500, { error: updateError.message || "Database update failed", host: supabaseHost });
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
    sendJson(res, 500, { error: err.message || "Update failed" });
  }
}
