(() => {
  const WS_URL = "wss://s.altnet.rippletest.net:51233";
  const FAUCET_URL = "https://faucet.altnet.rippletest.net/accounts";
  const TRANSFERABLE_FLAG = 0x00000008;
  const DEFAULT_IMAGE_URL =
    "https://oqmhriicljlotpojyjky.supabase.co/storage/v1/object/public/xwing%20image%20default/xwing.jpg";
  const TX_TIMEOUT_MS = 45000;
  const PENDING_ANCHOR_KEY = "xwingPendingAnchor";

  const state = {
    client: null,
    wallet: null,
    busy: false,
    pendingAnchor: null,
  };

  const el = (id) => document.getElementById(id);

  const logEl = el("log");
  const statusDot = el("status-dot");
  const statusText = el("status-text");

  const connectBtn = el("connect-btn");
  const disconnectBtn = el("disconnect-btn");
  const generateBtn = el("generate-btn");
  const loadBtn = el("load-btn");
  const faucetBtn = el("faucet-btn");
  const balanceBtn = el("balance-btn");
  const mintBtn = el("mint-btn");
  const eventBtn = el("event-btn");
  const nftRefreshBtn = el("nft-refresh-btn");

  const walletSeed = el("wallet-seed");
  const walletAddress = el("wallet-address");
  const walletBalance = el("wallet-balance");
  const ledgerIndex = el("ledger-index");
  const serverBuild = el("server-build");

  const mintUri = el("mint-uri");
  const mintTaxon = el("mint-taxon");
  const mintTransferable = el("mint-transferable");

  const metaFile = el("meta-file");
  const metaPreviewBtn = el("meta-preview-btn");
  const metaDownloadBtn = el("meta-download-btn");
  const metaItemId = el("meta-item-id");
  const metaName = el("meta-name");
  const metaDescription = el("meta-description");
  const metaImage = el("meta-image");
  const metaExternalUrl = el("meta-external-url");
  const metaSerial = el("meta-serial");
  const metaMaterial = el("meta-material");
  const metaColor = el("meta-color");
  const metaFacilityCountry = el("meta-facility-country");
  const metaPrintJob = el("meta-print-job");
  const metaMachineId = el("meta-machine-id");
  const metaOperatorId = el("meta-operator-id");
  const metaQaStatus = el("meta-qa-status");
  const metaCreatedAt = el("meta-created-at");
  const metaVersion = el("meta-version");
  const metaExtraAttrs = el("meta-extra-attrs");
  const metaPreview = el("meta-preview");
  const sbFolder = el("sb-folder");
  const updateItemId = el("update-item-id");
  const updateBtn = el("update-btn");
  const retryAnchorBtn = el("retry-anchor-btn");

  const eventItemSelect = el("event-item-select");
  const eventType = el("event-type");
  const eventPayload = el("event-payload");
  const eventHash = el("event-hash");

  const nftList = el("nft-list");

  function timestamp() {
    const now = new Date();
    return now.toISOString().split("T")[1].replace("Z", "");
  }

  function log(message, level = "info") {
    const line = `[${timestamp()}] ${message}`;
    const next = logEl.textContent ? `${logEl.textContent}\n${line}` : line;
    logEl.textContent = next.split("\n").slice(-200).join("\n");
    if (level === "error") {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  function setStatus(connected) {
    statusText.textContent = connected ? "Connected" : "Disconnected";
    if (connected) {
      statusDot.classList.add("ok");
    } else {
      statusDot.classList.remove("ok");
    }
    refreshActions();
  }

  function refreshActions() {
    const connected = state.client && state.client.isConnected();
    const hasWallet = !!state.wallet;
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
    faucetBtn.disabled = !connected || !hasWallet || state.busy;
    balanceBtn.disabled = !connected || !hasWallet || state.busy;
    mintBtn.disabled = !connected || !hasWallet || state.busy;
    updateBtn.disabled = !connected || !hasWallet || state.busy;
    retryAnchorBtn.disabled = !connected || !hasWallet || state.busy || !state.pendingAnchor;
    eventBtn.disabled = !connected || !hasWallet || state.busy;
    nftRefreshBtn.disabled = !connected || !hasWallet || state.busy;
  }

  async function connect() {
    if (!window.xrpl) {
      log("xrpl.js not loaded. Check the script tag.", "error");
      return;
    }
    try {
      if (state.client && state.client.isConnected()) {
        return;
      }
      state.client = new xrpl.Client(WS_URL);
      await state.client.connect();
      setStatus(true);
      log("Connected to XRPL testnet.");
      await updateServerInfo();
    } catch (err) {
      log(`Connect failed: ${err.message || err}`, "error");
      setStatus(false);
    }
  }

  async function disconnect() {
    if (state.client) {
      await state.client.disconnect();
      log("Disconnected.");
      setStatus(false);
    }
  }

  async function updateServerInfo() {
    try {
      const info = await state.client.request({ command: "server_info" });
      const validated = info.result.info.validated_ledger;
      ledgerIndex.textContent = validated ? validated.seq : "-";
      serverBuild.textContent = info.result.info.build_version || "-";
    } catch (err) {
      log(`Server info failed: ${err.message || err}`, "error");
    }
  }

  function updateWalletUI() {
    if (state.wallet) {
      walletAddress.textContent = state.wallet.classicAddress;
      walletSeed.value = state.wallet.seed;
    } else {
      walletAddress.textContent = "-";
    }
    refreshActions();
  }

  async function generateWallet() {
    state.wallet = xrpl.Wallet.generate();
    updateWalletUI();
    log("Generated new wallet.");
  }

  function loadWallet() {
    const seed = walletSeed.value.trim();
    if (!seed) {
      log("Seed is empty.", "error");
      return;
    }
    try {
      state.wallet = xrpl.Wallet.fromSeed(seed);
      updateWalletUI();
      log("Loaded wallet from seed.");
    } catch (err) {
      log(`Seed invalid: ${err.message || err}`, "error");
    }
  }

  async function fundWallet() {
    if (!state.wallet) {
      log("No wallet loaded.", "error");
      return;
    }
    state.busy = true;
    refreshActions();
    try {
      const res = await fetch(FAUCET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: state.wallet.classicAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Faucet request failed");
      }
      log(`Faucet funded: ${data?.amount || "unknown"} XRP`);
      await refreshBalance();
    } catch (err) {
      log(`Faucet failed: ${err.message || err}`, "error");
    } finally {
      state.busy = false;
      refreshActions();
    }
  }

  async function refreshBalance() {
    if (!state.wallet) {
      return;
    }
    try {
      const balance = await state.client.getXrpBalance(state.wallet.classicAddress);
      walletBalance.textContent = `${balance} XRP`;
    } catch (err) {
      log(`Balance failed: ${err.message || err}`, "error");
    }
  }

  function toHex(value) {
    if (window.xrpl && xrpl.convertStringToHex) {
      return xrpl.convertStringToHex(value);
    }
    return Array.from(value)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
  }

  function fromHex(value) {
    if (window.xrpl && xrpl.convertHexToString) {
      try {
        return xrpl.convertHexToString(value);
      } catch (err) {
        return value;
      }
    }
    return value;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label || "Operation"} timed out after ${ms}ms`));
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function loadPendingAnchor() {
    try {
      const raw = localStorage.getItem(PENDING_ANCHOR_KEY);
      if (!raw) {
        return null;
      }
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") {
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  }

  function savePendingAnchor(payload) {
    if (!payload) {
      return;
    }
    try {
      localStorage.setItem(PENDING_ANCHOR_KEY, JSON.stringify(payload));
    } catch (err) {
      // ignore storage errors
    }
    state.pendingAnchor = payload;
    refreshActions();
  }

  function clearPendingAnchor() {
    localStorage.removeItem(PENDING_ANCHOR_KEY);
    state.pendingAnchor = null;
    refreshActions();
  }

  function buildViewerUrl(itemId, origin) {
    if (!itemId) {
      return "";
    }
    try {
      const base = origin || window.location.origin;
      const url = new URL("view.html", base);
      url.searchParams.set("id", itemId);
      return url.toString();
    } catch (err) {
      return "";
    }
  }

  function extractViewerId(uri) {
    if (!uri) {
      return null;
    }
    try {
      const url = new URL(uri);
      if (!/\/view\.html$/i.test(url.pathname)) {
        return null;
      }
      const id = url.searchParams.get("id");
      return id ? id.trim() : null;
    } catch (err) {
      return null;
    }
  }

  async function fetchMetadataById(itemId, origin) {
    if (!itemId) {
      return { error: "Missing item id", viewer: true };
    }
    try {
      const endpoint = new URL("/api/metadata", origin || window.location.origin);
      endpoint.searchParams.set("id", itemId);
      const res = await fetch(endpoint.toString(), { mode: "cors" });
      if (!res.ok) {
        return { error: `HTTP ${res.status}`, viewer: true };
      }
      const payload = await res.json();
      if (!payload?.metadata) {
        return { error: "Metadata missing", viewer: true };
      }
      return {
        data: payload.metadata,
        sourceUrl: payload.metadata_url || payload.metadataUrl || payload.publicUrl || "",
        viewer: true,
      };
    } catch (err) {
      return { error: err.message || String(err), viewer: true };
    }
  }

  async function fetchMetadata(uri) {
    if (!uri) {
      return { error: "Missing URI" };
    }
    if (!/^https?:\/\//i.test(uri)) {
      return { error: "Unsupported URI scheme" };
    }
    const viewerId = extractViewerId(uri);
    if (viewerId) {
      let origin;
      try {
        origin = new URL(uri).origin;
      } catch (err) {
        origin = window.location.origin;
      }
      return fetchMetadataById(viewerId, origin);
    }
    try {
      const res = await fetch(uri, { mode: "cors" });
      if (!res.ok) {
        return { error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data, sourceUrl: uri, viewer: false };
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }

  function renderAttributeTags(attributes) {
    if (!Array.isArray(attributes) || attributes.length === 0) {
      return "";
    }
    const visible = attributes.slice(0, 6);
    const items = visible
      .map((attr) => {
        const key = escapeHtml(attr.trait_type || "attr");
        const value = escapeHtml(attr.value ?? "");
        return `<span class="nft-attr">${key}: ${value}</span>`;
      })
      .join("");
    const extra =
      attributes.length > visible.length
        ? `<span class="nft-attr">+${attributes.length - visible.length} more</span>`
        : "";
    return `<div class="nft-attrs">${items}${extra}</div>`;
  }

  function populateEventItemSelect(enriched) {
    if (!eventItemSelect) {
      return;
    }
    const previous = eventItemSelect.value;
    const options = new Map();
    enriched.forEach(({ nft, meta }) => {
      const metaData = meta.data;
      const itemId = metaData?.trace?.item_id || metaData?.name;
      if (!itemId || options.has(itemId)) {
        return;
      }
      const tokenId = nft?.NFTokenID ? nft.NFTokenID.slice(0, 8) : "";
      const label = tokenId ? `${itemId} - ${tokenId}...` : itemId;
      options.set(itemId, label);
    });

    eventItemSelect.innerHTML = "";
    if (options.size === 0) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "No traceable NFTs found";
      eventItemSelect.appendChild(emptyOption);
      eventItemSelect.disabled = true;
      return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select an item";
    eventItemSelect.appendChild(placeholder);

    options.forEach((label, itemId) => {
      const option = document.createElement("option");
      option.value = itemId;
      option.textContent = label;
      eventItemSelect.appendChild(option);
    });

    eventItemSelect.disabled = false;
    if (previous && options.has(previous)) {
      eventItemSelect.value = previous;
    }
  }

  function toDateInputValue(date) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().split("T")[0];
  }

  async function uploadMetadataToSupabase() {
    let metadata;
    try {
      metadata = buildMetadata();
    } catch (err) {
      const message = err.message || err;
      metaPreview.textContent = `Error: ${message}`;
      log(`Metadata error: ${message}`, "error");
      return null;
    }
    const json = JSON.stringify(metadata, null, 2);
    metaPreview.textContent = json;
    const fileName = metaFile.value.trim();
    const folder = sbFolder.value.trim();
    try {
      const res = await fetch("/api/upload-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata, fileName, folder }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail ? ` (${JSON.stringify(data.detail)})` : "";
        throw new Error(`${data?.error || "Supabase upload failed"}${detail}`);
      }
      if (!data.publicUrl) {
        log("Upload ok but no public URL.", "error");
        return null;
      }
      const viewerUrl = buildViewerUrl(data.itemId);
      mintUri.value = viewerUrl || data.publicUrl;
      if (data.itemId) {
        metaItemId.value = data.itemId;
        if (updateItemId) {
          updateItemId.value = data.itemId;
        }
      }
      if (data.name) {
        metaName.value = data.name;
      }
      if (data.fileName) {
        metaFile.value = data.fileName;
      }
      if (data.metadata) {
        metaPreview.textContent = JSON.stringify(data.metadata, null, 2);
      }
      log(`Supabase upload ok: ${data.publicUrl}`);
      return data;
    } catch (err) {
      log(`Supabase upload failed: ${err.message || err}`, "error");
      return null;
    }
  }

  async function updateMetadataToSupabase(itemId) {
    if (!itemId) {
      log("Update failed: item id is required.", "error");
      return null;
    }
    let metadata;
    try {
      metadata = buildMetadata(itemId);
    } catch (err) {
      const message = err.message || err;
      metaPreview.textContent = `Error: ${message}`;
      log(`Metadata error: ${message}`, "error");
      return null;
    }
    const json = JSON.stringify(metadata, null, 2);
    metaPreview.textContent = json;
    const folder = sbFolder.value.trim();
    try {
      const res = await fetch("/api/update-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata, itemId, folder }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail ? ` (${JSON.stringify(data.detail)})` : "";
        throw new Error(`${data?.error || "Supabase update failed"}${detail}`);
      }
      if (!data.publicUrl) {
        log("Update ok but no public URL.", "error");
        return null;
      }
      if (data.itemId) {
        metaItemId.value = data.itemId;
        if (updateItemId) {
          updateItemId.value = data.itemId;
        }
      }
      if (data.name) {
        metaName.value = data.name;
      }
      if (data.metadata) {
        metaPreview.textContent = JSON.stringify(data.metadata, null, 2);
      }
      log(`Supabase update ok: ${data.publicUrl}`);
      return data;
    } catch (err) {
      log(`Supabase update failed: ${err.message || err}`, "error");
      return null;
    }
  }

  function isEmpty(value) {
    return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
  }

  function pushAttribute(attributes, traitType, value) {
    if (isEmpty(value)) {
      return;
    }
    const cleaned = typeof value === "string" ? value.trim() : value;
    attributes.push({ trait_type: traitType, value: cleaned });
  }

  function parseExtraAttributes(raw) {
    if (!raw || !raw.trim()) {
      return [];
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error("Extra attributes must be valid JSON.");
    }
    if (Array.isArray(parsed)) {
      return parsed.map((item) => {
        if (!item || typeof item !== "object" || !("trait_type" in item)) {
          throw new Error("Extra attributes array must contain objects with trait_type.");
        }
        return item;
      });
    }
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed).map((key) => ({ trait_type: key, value: parsed[key] }));
    }
    throw new Error("Extra attributes must be a JSON object or array.");
  }

  function buildMetadata(itemIdOverride) {
    const createdAt = metaCreatedAt.value || toDateInputValue(new Date());
    const resolvedItemId = itemIdOverride ? itemIdOverride.trim() : metaItemId.value.trim();
    const attributes = [];
    pushAttribute(attributes, "serial", metaSerial.value);
    pushAttribute(attributes, "material", metaMaterial.value);
    pushAttribute(attributes, "color", metaColor.value);
    pushAttribute(attributes, "qa_status", metaQaStatus.value);
    pushAttribute(attributes, "facility_country", metaFacilityCountry.value);
    pushAttribute(attributes, "created_at", createdAt);

    const extraAttributes = parseExtraAttributes(metaExtraAttrs.value);
    extraAttributes.forEach((item) => attributes.push(item));

    const metadata = {
      name: metaName.value.trim() || "XWing",
      description: metaDescription.value.trim() || "",
      attributes,
      trace: {
        item_id: resolvedItemId,
        created_at: createdAt,
        facility_country: metaFacilityCountry.value.trim(),
        print_job_id: metaPrintJob.value.trim(),
        machine_id: metaMachineId.value.trim(),
        operator_id: metaOperatorId.value.trim(),
        version: metaVersion.value.trim(),
      },
    };

    const image = metaImage.value.trim() || DEFAULT_IMAGE_URL;
    if (image) {
      metadata.image = image;
    }
    const externalUrl = metaExternalUrl.value.trim();
    if (externalUrl) {
      metadata.external_url = externalUrl;
    }

    return metadata;
  }

  function renderMetadataPreview(logErrors) {
    try {
      const metadata = buildMetadata();
      metaPreview.textContent = JSON.stringify(metadata, null, 2);
    } catch (err) {
      const message = err.message || err;
      metaPreview.textContent = `Error: ${message}`;
      if (logErrors) {
        log(`Metadata error: ${message}`, "error");
      }
    }
  }

  function downloadMetadata() {
    let metadata;
    try {
      metadata = buildMetadata();
    } catch (err) {
      const message = err.message || err;
      metaPreview.textContent = `Error: ${message}`;
      log(`Metadata error: ${message}`, "error");
      return;
    }
    const json = JSON.stringify(metadata, null, 2);
    metaPreview.textContent = json;
    const fileName = metaFile.value.trim() || `metadata-${Date.now()}.json`;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    log(`Metadata JSON downloaded: ${fileName}`);
  }

  async function mintNft() {
    if (!state.wallet) {
      log("No wallet loaded.", "error");
      return;
    }
    state.busy = true;
    refreshActions();
    let released = false;
    const uploadData = await uploadMetadataToSupabase();
    if (!uploadData || !uploadData.publicUrl) {
      state.busy = false;
      refreshActions();
      return;
    }
    const viewerUrl = buildViewerUrl(uploadData.itemId);
    const uri = viewerUrl || uploadData.publicUrl;
    const taxon = Number(mintTaxon.value || 0);
    const flags = mintTransferable.checked ? TRANSFERABLE_FLAG : 0;
    const tx = {
      TransactionType: "NFTokenMint",
      Account: state.wallet.classicAddress,
      URI: toHex(uri),
      Flags: flags,
      NFTokenTaxon: taxon,
    };

    try {
      const prepared = await state.client.autofill(tx);
      const signed = state.wallet.sign(prepared);
      const result = await withTimeout(
        state.client.submitAndWait(signed.tx_blob),
        TX_TIMEOUT_MS,
        "Mint"
      );
      log(`Mint submitted: ${result.result.hash}`);
      await refreshBalance();
      const anchorPayload = {
        itemId: uploadData.itemId,
        metadata: uploadData.metadata,
        publicUrl: uploadData.publicUrl,
        eventType: "METADATA_CREATED",
      };
      const loadPromise = loadNfts();
      state.busy = false;
      released = true;
      refreshActions();
      void anchorMetadataChange(anchorPayload);
      await loadPromise;
    } catch (err) {
      const message = err.message || err;
      if (/timed out/i.test(message)) {
        log("Mint timed out waiting for validation. Check Load NFTs or the explorer.", "error");
      } else {
        log(`Mint failed: ${message}`, "error");
      }
    } finally {
      if (!released) {
        state.busy = false;
        refreshActions();
      }
    }
  }

  async function updateMetadata() {
    if (!state.wallet) {
      log("No wallet loaded.", "error");
      return;
    }
    const itemId = (updateItemId?.value || "").trim() || metaItemId.value.trim();
    if (!itemId) {
      log("Update failed: item id is required.", "error");
      return;
    }
    state.busy = true;
    refreshActions();
    let released = false;
    try {
      const updateData = await updateMetadataToSupabase(itemId);
      if (!updateData || !updateData.publicUrl) {
        return;
      }
      const anchorPayload = {
        itemId: updateData.itemId || itemId,
        metadata: updateData.metadata,
        publicUrl: updateData.publicUrl,
        eventType: "METADATA_UPDATED",
      };
      const loadPromise = loadNfts();
      await refreshBalance();
      state.busy = false;
      released = true;
      refreshActions();
      void anchorMetadataChange(anchorPayload);
      await loadPromise;
    } catch (err) {
      log(`Metadata update failed: ${err.message || err}`, "error");
    } finally {
      if (!released) {
        state.busy = false;
        refreshActions();
      }
    }
  }

  async function retryLastAnchor() {
    const pending = state.pendingAnchor || loadPendingAnchor();
    if (!pending) {
      log("No pending anchor to retry.", "error");
      return;
    }
    if (!state.wallet) {
      log("No wallet loaded.", "error");
      return;
    }
    state.busy = true;
    refreshActions();
    try {
      const result = await anchorMetadataChange(pending);
      if (result && !result.pending) {
        clearPendingAnchor();
      }
    } catch (err) {
      log(`Retry anchor failed: ${err.message || err}`, "error");
    } finally {
      state.busy = false;
      refreshActions();
    }
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(",")}]`;
    }
    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }

  async function sha256Hex(input) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function hashMetadata(metadata) {
    return sha256Hex(stableStringify(metadata));
  }

  async function checkItemExists(itemId) {
    if (!itemId) {
      return false;
    }
    try {
      const endpoint = new URL("/api/item-exists", window.location.origin);
      endpoint.searchParams.set("id", itemId);
      const res = await fetch(endpoint.toString(), { mode: "cors" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = await res.json();
      return !!payload?.exists;
    } catch (err) {
      log(`Item check failed: ${err.message || err}`, "error");
      return false;
    }
  }

  async function checkTxValidated(txHash) {
    if (!txHash) {
      return false;
    }
    try {
      const res = await state.client.request({ command: "tx", transaction: txHash });
      return !!res?.result?.validated;
    } catch (err) {
      return false;
    }
  }

  async function submitTraceEvent({ itemId, eventType, payload, payloadHash }) {
    if (!state.wallet) {
      throw new Error("No wallet loaded.");
    }
    const canonical = stableStringify(payload || {});
    const hash = payloadHash || (await sha256Hex(canonical));
    const memoData = stableStringify({
      item_id: itemId || "",
      event_type: eventType,
      payload_hash: hash,
    });

    const tx = {
      TransactionType: "Payment",
      Account: state.wallet.classicAddress,
      Destination: state.wallet.classicAddress,
      Amount: "1",
      Memos: [
        {
          Memo: {
            MemoType: toHex("trace_event"),
            MemoFormat: toHex("application/json"),
            MemoData: toHex(memoData),
          },
        },
      ],
    };

    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prepared = await state.client.autofill(tx, { maxLedgerVersionOffset: 300 });
      try {
        const ledger = await state.client.request({ command: "ledger_current" });
        const current = Number(ledger?.result?.ledger_current_index);
        if (Number.isFinite(current)) {
          prepared.LastLedgerSequence = current + 300;
        }
      } catch (err) {
        if (prepared.LastLedgerSequence) {
          prepared.LastLedgerSequence += 4;
        }
      }
      const signed = state.wallet.sign(prepared);
      const txHash = signed.hash;
      try {
        const result = await withTimeout(
          state.client.submitAndWait(signed.tx_blob),
          TX_TIMEOUT_MS,
          "Trace event"
        );
        return { txHash: result.result.hash || txHash, payloadHash: hash };
      } catch (err) {
        lastError = err;
        const message = err?.message || String(err);
        if (/timed out/i.test(message)) {
          const validated = await checkTxValidated(txHash);
          if (validated) {
            return { txHash, payloadHash: hash };
          }
          return { txHash, payloadHash: hash, pending: true };
        }
        if (!/LastLedgerSequence|temREDUNDANT|tefMAX_LEDGER/i.test(message)) {
          break;
        }
      }
    }
    throw lastError || new Error("Trace event submit failed.");
  }

  async function logTraceEvent({ itemId, eventType, payloadHash, payload, txHash }) {
    try {
      const res = await fetch("/api/log-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          eventType,
          payloadHash,
          payload,
          txHash,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail ? ` (${JSON.stringify(data.detail)})` : "";
        log(`Event log failed: ${data?.error || "Unknown error"}${detail}`, "error");
      }
    } catch (err) {
      log(`Event log failed: ${err.message || err}`, "error");
    }
  }

  async function anchorMetadataChange({ itemId, metadata, publicUrl, eventType }) {
    if (!itemId || !metadata) {
      log("Metadata anchor skipped: missing data.", "error");
      return null;
    }
    try {
      const metadataHash = await hashMetadata(metadata);
      const metadataVersion = metadata?.trace?.version || metadata?.version || "";
      const payload = {
        metadata_hash: metadataHash,
        metadata_url: publicUrl,
        metadata_version: metadataVersion || undefined,
      };
      const traceResult = await submitTraceEvent({
        itemId,
        eventType,
        payload,
      });
      if (traceResult.pending) {
        savePendingAnchor({ itemId, eventType, metadata, publicUrl });
        log(`Metadata anchor pending: ${traceResult.txHash}. Retry when ready.`);
        return { txHash: traceResult.txHash, metadataHash, pending: true };
      }
      const { txHash, payloadHash } = traceResult;
      await logTraceEvent({
        itemId,
        eventType,
        payloadHash,
        payload,
        txHash,
      });
      if (state.pendingAnchor?.itemId === itemId && state.pendingAnchor?.eventType === eventType) {
        clearPendingAnchor();
      }
      log(`Metadata anchored (${eventType}): ${txHash}`);
      return { txHash, metadataHash };
    } catch (err) {
      const message = err.message || err;
      savePendingAnchor({ itemId, eventType, metadata, publicUrl });
      if (/timed out/i.test(message)) {
        log("Metadata anchor timed out. Retry when ready.", "error");
      } else {
        log(`Metadata anchor failed: ${message}`, "error");
      }
      return null;
    }
  }

  async function anchorEvent() {
    if (!state.wallet) {
      log("No wallet loaded.", "error");
      return;
    }
    const itemId = eventItemSelect.value.trim();
    if (!itemId) {
      log("Select an item from your wallet first.", "error");
      return;
    }
    const exists = await checkItemExists(itemId);
    if (!exists) {
      log(`Item not found in database: ${itemId}`, "error");
      return;
    }
    let payloadObj = {};
    const payloadText = eventPayload.value.trim();
    if (payloadText) {
      try {
        payloadObj = JSON.parse(payloadText);
      } catch (err) {
        log("Payload must be valid JSON.", "error");
        return;
      }
    }
    const payloadCanonical = stableStringify(payloadObj);
    const hash = await sha256Hex(payloadCanonical);
    eventHash.textContent = hash;

    state.busy = true;
    refreshActions();
    try {
      const eventTypeValue = eventType.value;
      const traceResult = await submitTraceEvent({
        itemId,
        eventType: eventTypeValue,
        payload: payloadObj,
        payloadHash: hash,
      });
      if (traceResult.pending) {
        log(`Event anchor pending: ${traceResult.txHash}. Check explorer or retry later.`, "error");
        return;
      }
      const { txHash, payloadHash } = traceResult;
      await logTraceEvent({
        itemId,
        eventType: eventTypeValue,
        payloadHash: payloadHash || hash,
        payload: payloadObj,
        txHash,
      });
      log(`Event anchored: ${txHash}`);
      await refreshBalance();
    } catch (err) {
      const message = err.message || err;
      if (/timed out/i.test(message)) {
        log("Anchor timed out. Try again in a few seconds.", "error");
      } else {
        log(`Anchor failed: ${message}`, "error");
      }
    } finally {
      state.busy = false;
      refreshActions();
    }
  }

  async function loadNfts() {
    if (!state.wallet) {
      return;
    }
    try {
      const result = await state.client.request({
        command: "account_nfts",
        account: state.wallet.classicAddress,
        limit: 12,
      });
      const nfts = result.result.account_nfts || [];
      if (!nfts.length) {
        nftList.innerHTML = "<div class=\"empty\">No NFTs found.</div>";
        populateEventItemSelect([]);
        return;
      }
      nftList.innerHTML = `<div class="empty">Loading ${nfts.length} NFTs...</div>`;
      const enriched = await Promise.all(
        nfts.map(async (nft) => {
          const uri = nft.URI ? fromHex(nft.URI) : "";
          const meta = await fetchMetadata(uri);
          return { nft, uri, meta };
        })
      );
      populateEventItemSelect(enriched);
      nftList.innerHTML = enriched
        .map(({ nft, uri, meta }) => {
          const metaData = meta.data;
          const metaName = metaData?.name ? escapeHtml(metaData.name) : "Unnamed";
          const metaDesc = metaData?.description ? escapeHtml(metaData.description) : "";
          const metaImage = metaData?.image ? escapeHtml(metaData.image) : "";
          const metaError = meta.error ? escapeHtml(meta.error) : "";
          const attributesHtml = metaData?.attributes ? renderAttributeTags(metaData.attributes) : "";
          const uriLabel = meta.viewer ? "Open viewer" : "Metadata URI";
          const uriLink = uri
            ? `<a class="nft-link" href="${escapeHtml(uri)}" target="_blank" rel="noreferrer">${uriLabel}</a>`
            : "no uri";
          const sourceUrl =
            meta.sourceUrl && meta.sourceUrl !== uri
              ? `<a class="nft-link" href="${escapeHtml(meta.sourceUrl)}" target="_blank" rel="noreferrer">Metadata JSON</a>`
              : "";
          return `<div class="nft-item">
            <div class="mono">${escapeHtml(nft.NFTokenID)}</div>
            <div class="hint">${uriLink}${sourceUrl ? ` - ${sourceUrl}` : ""}</div>
            ${
              metaData
                ? `<div class="nft-meta">
                    <div class="nft-title">${metaName}</div>
                    ${metaDesc ? `<div class="nft-desc">${metaDesc}</div>` : ""}
                    ${metaImage ? `<div class="nft-link">${metaImage}</div>` : ""}
                    ${attributesHtml}
                  </div>`
                : `<div class="hint">Metadata: ${metaError || "not available"}</div>`
            }
          </div>`;
        })
        .join("");
    } catch (err) {
      log(`Load NFTs failed: ${err.message || err}`, "error");
    }
  }

  connectBtn.addEventListener("click", connect);
  disconnectBtn.addEventListener("click", disconnect);
  generateBtn.addEventListener("click", generateWallet);
  loadBtn.addEventListener("click", loadWallet);
  metaPreviewBtn.addEventListener("click", () => renderMetadataPreview(true));
  metaDownloadBtn.addEventListener("click", downloadMetadata);
  faucetBtn.addEventListener("click", fundWallet);
  balanceBtn.addEventListener("click", refreshBalance);
  mintBtn.addEventListener("click", mintNft);
  updateBtn.addEventListener("click", updateMetadata);
  retryAnchorBtn.addEventListener("click", retryLastAnchor);
  eventBtn.addEventListener("click", anchorEvent);
  nftRefreshBtn.addEventListener("click", loadNfts);

  window.addEventListener("load", () => {
    el("net-url").textContent = WS_URL;
    if (metaCreatedAt && !metaCreatedAt.value) {
      metaCreatedAt.value = toDateInputValue(new Date());
    }
    state.pendingAnchor = loadPendingAnchor();
    if (state.pendingAnchor?.itemId) {
      log(`Pending anchor loaded for ${state.pendingAnchor.itemId}.`);
    }
    if (eventItemSelect) {
      eventItemSelect.disabled = true;
    }
    renderMetadataPreview(false);
    refreshActions();
    connect();
  });
})();
