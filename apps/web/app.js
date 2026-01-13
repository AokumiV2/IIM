(() => {
  const WS_URL = "wss://s.altnet.rippletest.net:51233";
  const FAUCET_URL = "https://faucet.altnet.rippletest.net/accounts";
  const TRANSFERABLE_FLAG = 0x00000008;

  const state = {
    client: null,
    wallet: null,
    busy: false,
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
  const metaApplyUriBtn = el("meta-apply-uri-btn");
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

  const eventItemId = el("event-item-id");
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

  async function fetchMetadata(uri) {
    if (!uri) {
      return { error: "Missing URI" };
    }
    if (!/^https?:\/\//i.test(uri)) {
      return { error: "Unsupported URI scheme" };
    }
    try {
      const res = await fetch(uri, { mode: "cors" });
      if (!res.ok) {
        return { error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { data };
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

  function toDateInputValue(date) {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().split("T")[0];
  }

  function metadataFileToUri(fileName) {
    return fileName ? `https://iim-one.vercel.app/${fileName}` : "";
  }

  function applyMetadataUri() {
    const fileName = metaFile.value.trim();
    if (!fileName) {
      log("Metadata filename missing.", "error");
      return;
    }
    mintUri.value = metadataFileToUri(fileName);
    log(`Mint URI set to ${mintUri.value}`);
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

  function buildMetadata() {
    const createdAt = metaCreatedAt.value || toDateInputValue(new Date());
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
        item_id: metaItemId.value.trim(),
        created_at: createdAt,
        facility_country: metaFacilityCountry.value.trim(),
        print_job_id: metaPrintJob.value.trim(),
        machine_id: metaMachineId.value.trim(),
        operator_id: metaOperatorId.value.trim(),
        version: metaVersion.value.trim(),
      },
    };

    const image = metaImage.value.trim();
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
    const uri = mintUri.value.trim();
    if (!uri) {
      log("Metadata URI missing.", "error");
      return;
    }
    const taxon = Number(mintTaxon.value || 0);
    const flags = mintTransferable.checked ? TRANSFERABLE_FLAG : 0;
    const tx = {
      TransactionType: "NFTokenMint",
      Account: state.wallet.classicAddress,
      URI: toHex(uri),
      Flags: flags,
      NFTokenTaxon: taxon,
    };

    state.busy = true;
    refreshActions();
    try {
      const prepared = await state.client.autofill(tx);
      const signed = state.wallet.sign(prepared);
      const result = await state.client.submitAndWait(signed.tx_blob);
      log(`Mint submitted: ${result.result.hash}`);
      await refreshBalance();
      await loadNfts();
    } catch (err) {
      log(`Mint failed: ${err.message || err}`, "error");
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

  async function anchorEvent() {
    if (!state.wallet) {
      log("No wallet loaded.", "error");
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

    const memoData = stableStringify({
      item_id: eventItemId.value.trim(),
      event_type: eventType.value,
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

    state.busy = true;
    refreshActions();
    try {
      const prepared = await state.client.autofill(tx);
      const signed = state.wallet.sign(prepared);
      const result = await state.client.submitAndWait(signed.tx_blob);
      log(`Event anchored: ${result.result.hash}`);
      await refreshBalance();
    } catch (err) {
      log(`Anchor failed: ${err.message || err}`, "error");
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
      nftList.innerHTML = enriched
        .map(({ nft, uri, meta }) => {
          const metaData = meta.data;
          const metaName = metaData?.name ? escapeHtml(metaData.name) : "Unnamed";
          const metaDesc = metaData?.description ? escapeHtml(metaData.description) : "";
          const metaImage = metaData?.image ? escapeHtml(metaData.image) : "";
          const metaError = meta.error ? escapeHtml(meta.error) : "";
          const attributesHtml = metaData?.attributes ? renderAttributeTags(metaData.attributes) : "";
          return `<div class="nft-item">
            <div class="mono">${escapeHtml(nft.NFTokenID)}</div>
            <div class="hint">${uri ? escapeHtml(uri) : "no uri"}</div>
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
  metaApplyUriBtn.addEventListener("click", applyMetadataUri);
  metaPreviewBtn.addEventListener("click", () => renderMetadataPreview(true));
  metaDownloadBtn.addEventListener("click", downloadMetadata);
  faucetBtn.addEventListener("click", fundWallet);
  balanceBtn.addEventListener("click", refreshBalance);
  mintBtn.addEventListener("click", mintNft);
  eventBtn.addEventListener("click", anchorEvent);
  nftRefreshBtn.addEventListener("click", loadNfts);

  window.addEventListener("load", () => {
    el("net-url").textContent = WS_URL;
    if (metaCreatedAt && !metaCreatedAt.value) {
      metaCreatedAt.value = toDateInputValue(new Date());
    }
    renderMetadataPreview(false);
    refreshActions();
    connect();
  });
})();
