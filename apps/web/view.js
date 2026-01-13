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
      setStatus("Metadata loaded.");
    } catch (err) {
      setStatus(`Failed to load metadata: ${err.message || err}`);
      assetDescription.textContent = "Unable to load metadata.";
      clearContainer(traceGrid, "No trace data.");
      clearContainer(attrTags, "No attributes");
      showLink(jsonLink, "", "Metadata JSON");
      showLink(externalLink, "", "External link");
      renderImage("");
    }
  }

  window.addEventListener("load", init);
})();
