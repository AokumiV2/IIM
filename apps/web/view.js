(() => {
  const el = (id) => document.getElementById(id);

  const assetTitle = el("asset-title");
  const assetSubtitle = el("asset-subtitle");
  const assetId = el("asset-id");
  const assetStatus = el("asset-status");
  const assetDescription = el("asset-description");
  const traceGrid = el("trace-grid");
  const attrTags = el("attr-tags");
  const jsonLink = el("json-link");
  const externalLink = el("external-link");
  const imageFrame = el("image-frame");
  const imageEl = el("asset-image");
  const imageFallback = el("image-fallback");
  const imageCaption = el("image-caption");
  const footerStatus = el("footer-status");
  const eventList = el("event-list");
  const eventWarning = el("event-warning");

  function setStatus(text) {
    assetStatus.textContent = text;
    footerStatus.textContent = text;
  }

  function setBadge(text) {
    assetId.textContent = text || "item id";
  }

  function showLink(link, href, label) {
    if (!href) {
      link.classList.add("hidden");
      link.removeAttribute("href");
      return;
    }
    link.textContent = label;
    link.href = href;
    link.classList.remove("hidden");
  }

  function clearContainer(node, fallbackText) {
    if (!node) {
      return;
    }
    if (fallbackText) {
      node.textContent = fallbackText;
    } else {
      node.innerHTML = "";
    }
  }

  function formatKey(key) {
    return String(key).replace(/_/g, " ");
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

  function renderKeyValue(container, obj) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    if (!obj || typeof obj !== "object") {
      container.textContent = "No trace data.";
      return;
    }
    const entries = Object.entries(obj).filter(([, value]) => value !== null && value !== undefined && value !== "");
    if (!entries.length) {
      container.textContent = "No trace data.";
      return;
    }
    entries.forEach(([key, value]) => {
      const card = document.createElement("div");
      card.className = "kv";
      const keyEl = document.createElement("div");
      keyEl.className = "key";
      keyEl.textContent = formatKey(key);
      const valueEl = document.createElement("div");
      valueEl.className = "value";
      valueEl.textContent = String(value);
      card.appendChild(keyEl);
      card.appendChild(valueEl);
      container.appendChild(card);
    });
  }

  function renderAttributes(container, attributes) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    if (!Array.isArray(attributes) || attributes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tag";
      empty.textContent = "No attributes";
      container.appendChild(empty);
      return;
    }
    attributes.forEach((attr) => {
      const label = `${attr.trait_type || "attr"}: ${attr.value ?? ""}`;
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.textContent = label;
      container.appendChild(tag);
    });
  }

  function renderImage(url) {
    if (!url) {
      imageFrame.classList.add("is-empty");
      imageFallback.textContent = "No image available";
      imageCaption.textContent = "";
      return;
    }
    imageEl.src = url;
    imageEl.alt = "Asset preview";
    imageFrame.classList.remove("is-empty");
    imageFallback.textContent = "";
    imageCaption.textContent = url;
    imageEl.onerror = () => {
      imageFrame.classList.add("is-empty");
      imageFallback.textContent = "Image failed to load";
    };
  }

  async function loadById(itemId) {
    const endpoint = `/api/metadata?id=${encodeURIComponent(itemId)}`;
    const res = await fetch(endpoint, { mode: "cors" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    if (!payload?.metadata) {
      throw new Error("Metadata missing");
    }
    return {
      metadata: payload.metadata,
      sourceUrl: payload.metadata_url || payload.metadataUrl || payload.publicUrl || "",
    };
  }

  async function loadByUrl(url) {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const metadata = await res.json();
    return { metadata, sourceUrl: url };
  }

  async function fetchEvents(itemId) {
    const res = await fetch(`/api/events?id=${encodeURIComponent(itemId)}`, { mode: "cors" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    return Array.isArray(payload.events) ? payload.events : [];
  }

  function renderEvents(events, metadataHash) {
    if (!eventList) {
      return { verified: null };
    }
    eventList.innerHTML = "";
    eventWarning.classList.add("hidden");
    if (!Array.isArray(events) || events.length === 0) {
      const empty = document.createElement("div");
      empty.className = "event-card";
      empty.textContent = "No on-chain events found.";
      eventList.appendChild(empty);
      return { verified: null };
    }

    const metadataEvents = events.filter((event) => String(event.event_type || "").startsWith("METADATA_"));
    const listEvents = metadataEvents.length ? metadataEvents : events;

    listEvents.forEach((event) => {
      const card = document.createElement("div");
      card.className = "event-card";
      const type = document.createElement("div");
      type.className = "event-type";
      type.textContent = event.event_type || "EVENT";
      const meta = document.createElement("div");
      meta.className = "event-meta";
      const createdAt = event.created_at ? new Date(event.created_at).toLocaleString() : "unknown time";
      const tx = event.tx_hash ? `tx ${event.tx_hash}` : "tx pending";
      const metadataVersion = event.payload_json?.metadata_version
        ? ` · v${event.payload_json.metadata_version}`
        : "";
      meta.textContent = `${createdAt} · ${tx}${metadataVersion}`;
      card.appendChild(type);
      card.appendChild(meta);
      const metadataUrl = event.payload_json?.metadata_url || event.metadata_url || "";
      if (metadataUrl) {
        const links = document.createElement("div");
        links.className = "event-links";
        const link = document.createElement("a");
        link.href = metadataUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "Metadata JSON";
        links.appendChild(link);
        card.appendChild(links);
      }
      eventList.appendChild(card);
    });

    const latestWithHash = listEvents.find((event) => event.payload_json?.metadata_hash);
    if (!latestWithHash || !metadataHash) {
      return { verified: null };
    }
    const latestHash = latestWithHash.payload_json.metadata_hash;
    if (latestHash === metadataHash) {
      return { verified: true };
    }
    eventWarning.textContent = "Metadata mismatch: current JSON does not match the last anchored hash.";
    eventWarning.classList.remove("hidden");
    return { verified: false };
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get("id");
    const metadataUrl = params.get("url");

    if (!itemId && !metadataUrl) {
      setStatus("Missing id or url query param.");
      assetDescription.textContent = "Add ?id=xwing1 or ?url=https://...json";
      return;
    }

    setStatus("Loading metadata...");

    try {
      const { metadata, sourceUrl } = itemId ? await loadById(itemId) : await loadByUrl(metadataUrl);
      const trace = metadata.trace || {};
      const name = metadata.name || trace.item_id || "XWing";
      assetTitle.textContent = name;
      assetSubtitle.textContent = metadata.description || "XRPL metadata view.";
      assetDescription.textContent = metadata.description || "No description available.";
      setBadge(trace.item_id || name);
      renderImage(metadata.image || "");
      renderKeyValue(traceGrid, trace);
      renderAttributes(attrTags, metadata.attributes);
      showLink(jsonLink, sourceUrl, "Metadata JSON");
      showLink(externalLink, metadata.external_url || "", "External link");
      const metadataHash = await hashMetadata(metadata);
      let verification = { verified: null };
      if (itemId) {
        try {
          const events = await fetchEvents(itemId);
          verification = renderEvents(events, metadataHash);
        } catch (err) {
          eventWarning.textContent = "Event lookup failed.";
          eventWarning.classList.remove("hidden");
        }
      } else {
        eventList.textContent = "Events available when using ?id=.";
      }

      if (verification.verified === true) {
        setStatus("Metadata verified on-chain.");
      } else if (verification.verified === false) {
        setStatus("Metadata mismatch detected.");
      } else {
        setStatus("Metadata loaded.");
      }
    } catch (err) {
      setStatus(`Failed to load metadata: ${err.message || err}`);
      assetDescription.textContent = "Unable to load metadata.";
      clearContainer(traceGrid, "No trace data.");
      clearContainer(attrTags, "No attributes");
      clearContainer(eventList, "No on-chain events.");
      eventWarning.classList.add("hidden");
      showLink(jsonLink, "", "Metadata JSON");
      showLink(externalLink, "", "External link");
      renderImage("");
    }
  }

  window.addEventListener("load", init);
})();
