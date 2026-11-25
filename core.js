// Cloud Script Manager Core Engine (Auto-updated via Bootloader)
(function (ctx) {
  'use strict';

  const {
    GITHUB_USER,
    GITHUB_REPO,
    BRANCH,
    FOLDER_PATH,
    activeRef,
    GM_xmlhttpRequest,
    GM_getValue,
    GM_setValue,
    GM_addElement
  } = ctx;

  const STORAGE_KEY = "gh_master_enabled_scripts";
  const CACHE_KEY = "gh_master_cached_files_v2";
  const basePath = FOLDER_PATH ? `${FOLDER_PATH}/` : "";
  const SYSTEM_FILES = new Set(["master.user.js", "core.js"]);

  function fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const sep = url.includes("?") ? "&" : "?";
      GM_xmlhttpRequest({
        method: "GET",
        url: `${url}${sep}_t=${Date.now()}`,
        nocache: true,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        },
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText);
          else reject(new Error("HTTP " + res.status));
        },
        onerror: () => reject(new Error("Network error"))
      });
    });
  }

  async function resolveLatestRef() {
    // 1. Resolve exact latest commit SHA via jsDelivr API (bypasses @main & proxy cache)
    try {
      const res = await fetchUrl(`https://data.jsdelivr.com/v1/package/resolve/gh/${GITHUB_USER}/${GITHUB_REPO}@${BRANCH}`);
      const data = JSON.parse(res);
      if (data && data.version) return data.version;
    } catch (e) {}

    // 2. Fallback: purge @main and use branch name
    try {
      await fetchUrl(`https://purge.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${BRANCH}/core.js`);
    } catch (e) {}

    return activeRef || BRANCH;
  }

  function isUrlMatched(patterns, currentUrl) {
    if (!patterns || patterns.length === 0) return true;
    return patterns.some((pattern) => {
      if (pattern === "*://*/*" || pattern === "<all_urls>") return true;
      const regexStr = "^" + pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*") + "$";
      return new RegExp(regexStr).test(currentUrl);
    });
  }

  if (!window.__gh_gm_bridge_ready__) {
    window.__gh_gm_bridge_ready__ = true;
    window.addEventListener("__gh_gm_xhr__", (e) => {
      const { id, details } = e.detail || {};
      if (!id || !details) return;
      GM_xmlhttpRequest({
        method: details.method || "GET",
        url: details.url,
        headers: details.headers,
        data: details.data,
        onload: (res) => {
          window.dispatchEvent(new CustomEvent("__gh_gm_xhr_res_" + id, {
            detail: { ok: true, status: res.status, responseText: res.responseText }
          }));
        },
        onerror: (err) => {
          window.dispatchEvent(new CustomEvent("__gh_gm_xhr_res_" + id, {
            detail: { ok: false, error: err }
          }));
        }
      });
    });
  }

  function executeScriptCode(code, fileName) {
    try {
      const wrappedCode = `(function(){
        const GM_xmlhttpRequest = function(details) {
          const id = Math.random().toString(36).slice(2);
          window.addEventListener("__gh_gm_xhr_res_" + id, function handler(ev) {
            window.removeEventListener("__gh_gm_xhr_res_" + id, handler);
            if (ev.detail.ok && typeof details.onload === "function") details.onload(ev.detail);
            else if (!ev.detail.ok && typeof details.onerror === "function") details.onerror(ev.detail);
          });
          window.dispatchEvent(new CustomEvent("__gh_gm_xhr__", {
            detail: { id, details: { method: details.method || "GET", url: details.url, headers: details.headers, data: details.data } }
          }));
        };
        const GM_getValue = (k, d) => { try { const v = localStorage.getItem("__gh_gm_" + k); return v !== null ? JSON.parse(v) : d; } catch(e) { return d; } };
        const GM_setValue = (k, v) => { try { localStorage.setItem("__gh_gm_" + k, JSON.stringify(v)); } catch(e) {} };
        ${code}
      })();`;

      if (typeof GM_addElement === "function") {
        GM_addElement(document.head || document.documentElement, "script", {
          textContent: wrappedCode
        });
      } else {
        const scriptEl = document.createElement("script");
        scriptEl.textContent = wrappedCode;
        (document.head || document.documentElement).appendChild(scriptEl);
        scriptEl.remove();
      }
    } catch (err) {
      console.error(`[MasterRunner] Error running ${fileName}:`, err);
    }
  }

  async function listRepoFiles(ref) {
    // Auto-list all files in the exact commit via jsDelivr flat index
    try {
      const raw = await fetchUrl(`https://data.jsdelivr.com/v1/package/gh/${GITHUB_USER}/${GITHUB_REPO}@${ref}/flat`);
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.files)) {
        const prefix = FOLDER_PATH ? `/${FOLDER_PATH}/` : "/";
        const names = data.files
          .map((f) => f.name)
          .filter((n) => n.startsWith(prefix))
          .map((n) => n.slice(prefix.length))
          .filter((n) => !n.includes("/"));

        return {
          scripts: names.filter((n) => n.endsWith(".js") && !SYSTEM_FILES.has(n)),
          pages: names.filter((n) => n.endsWith(".html"))
        };
      }
    } catch (e) {}

    // Backup fallback to scripts.json if flat index fails
    const cdnBase = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${ref}/${basePath}`;
    const manifestRaw = await fetchUrl(`${cdnBase}scripts.json`);
    const manifest = JSON.parse(manifestRaw);
    return {
      scripts: (manifest.scripts || []).filter((n) => n.endsWith(".js") && !SYSTEM_FILES.has(n)),
      pages: manifest.pages || []
    };
  }

  async function syncAndRun(runScripts = true, forceResolve = false) {
    const enabledMap = GM_getValue(STORAGE_KEY, {});
    let cachedData = GM_getValue(CACHE_KEY, { scripts: [], pages: [] });

    if (runScripts && cachedData.scripts.length > 0) {
      cachedData.scripts.forEach((s) => {
        if (enabledMap[s.fileName] && isUrlMatched(s.matches, window.location.href)) {
          executeScriptCode(s.code, s.fileName);
        }
      });
    }

    try {
      const ref = forceResolve ? await resolveLatestRef() : (activeRef || await resolveLatestRef());
      const cdnBase = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${ref}/${basePath}`;
      const { scripts: scriptNames, pages: pageNames } = await listRepoFiles(ref);

      const updatedScripts = [];
      let mapChanged = false;

      for (const fileName of scriptNames) {
        const code = await fetchUrl(`${cdnBase}${fileName}`);
        const nameMatch = code.match(/\/\/\s*@name\s+(.+)/);
        const displayName = nameMatch ? nameMatch[1].trim() : fileName;
        const matches = [...code.matchAll(/\/\/\s*@match\s+(.+)/g)].map((m) => m[1].trim());
        const autoMatch = code.match(/\/\/\s*@auto\s+(true|false)/i);
        const forceMatch = code.match(/\/\/\s*@force\s+(true|false)/i);

        if (!(fileName in enabledMap)) {
          enabledMap[fileName] = autoMatch ? autoMatch[1].toLowerCase() === "true" : false;
          mapChanged = true;
        }

        if (forceMatch) {
          const forcedState = forceMatch[1].toLowerCase() === "true";
          if (enabledMap[fileName] !== forcedState) {
            enabledMap[fileName] = forcedState;
            mapChanged = true;
          }
        }

        updatedScripts.push({ fileName, displayName, matches, code });
      }

      const htmlFiles = pageNames.map((pName) => ({
        name: pName,
        url: `https://${GITHUB_USER}.github.io/${GITHUB_REPO}/${basePath}${pName}`
      }));

      if (mapChanged) GM_setValue(STORAGE_KEY, enabledMap);

      const shortRef = ref.length > 7 ? ref.slice(0, 7) : ref;
      cachedData = {
        scripts: updatedScripts,
        pages: htmlFiles,
        lastSync: `${new Date().toLocaleTimeString("en-US")} [${shortRef}]`
      };
      GM_setValue(CACHE_KEY, cachedData);
      return cachedData;
    } catch (e) {
      console.warn("[MasterRunner] Sync failed:", e.message);
      return cachedData;
    }
  }

  function toggleControlPanel() {
    const existing = document.getElementById("gh-master-panel-overlay");
    if (existing) {
      existing.remove();
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "gh-master-panel-overlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 2147483647;
      display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; direction: ltr; text-align: left;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      width: 380px; max-height: 80vh; overflow-y: auto; background: #161b22; color: #e6edf3;
      border: 1px solid #30363d; border-radius: 12px; padding: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);
    `;

    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <strong style="font-size:15px;">⚙️ Cloud Script Manager</strong>
        <button id="gh-close-btn" style="background:none; border:none; color:#8b949e; font-size:18px; cursor:pointer;" title="Close">✖</button>
      </div>
      <button id="gh-sync-btn" style="width:100%; padding:9px; background:#238636; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-bottom:8px;">
        🔄 Sync & Update Now
      </button>
      <div id="gh-status" style="font-size:11px; color:#8b949e; text-align:center; margin-bottom:12px;"></div>
      <div style="font-size:12px; color:#8b949e; border-bottom:1px solid #30363d; padding-bottom:4px; margin-bottom:8px;">Available Scripts (JS)</div>
      <div id="gh-scripts-list"></div>
      <div style="font-size:12px; color:#8b949e; border-bottom:1px solid #30363d; padding-bottom:4px; margin:12px 0 8px;">Pages (HTML)</div>
      <div id="gh-pages-list"></div>
      <div style="font-size:11px; color:#8b949e; text-align:center; margin-top:12px;">Reload the page (F5) after enabling or disabling any script</div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const renderList = () => {
      const enabledMap = GM_getValue(STORAGE_KEY, {});
      const data = GM_getValue(CACHE_KEY, { scripts: [], pages: [], lastSync: "-" });
      document.getElementById("gh-status").textContent = `Last sync: ${data.lastSync || "-"}`;

      const listEl = document.getElementById("gh-scripts-list");
      if (!data.scripts.length) {
        listEl.innerHTML = `<div style="font-size:12px; color:#8b949e; text-align:center; padding:8px;">No JS files found</div>`;
      } else {
        listEl.innerHTML = "";
        data.scripts.forEach((s) => {
          const isOn = !!enabledMap[s.fileName];
          const row = document.createElement("div");
          row.style.cssText = `
            display:flex; justify-content:space-between; align-items:center; padding:8px 10px;
            background:#0d1117; border:1px solid #30363d; border-radius:8px; margin-bottom:6px; gap:10px;
          `;
          row.innerHTML = `
            <div style="overflow:hidden; text-align:left;">
              <div style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.displayName}</div>
              <div style="font-size:10px; color:#8b949e;">${s.fileName}</div>
            </div>
            <input type="checkbox" ${isOn ? "checked" : ""} style="width:18px; height:18px; accent-color:#2ea043; cursor:pointer; flex-shrink:0;">
          `;
          row.querySelector("input").addEventListener("change", (e) => {
            const map = GM_getValue(STORAGE_KEY, {});
            map[s.fileName] = e.target.checked;
            GM_setValue(STORAGE_KEY, map);
          });
          listEl.appendChild(row);
        });
      }

      const pagesEl = document.getElementById("gh-pages-list");
      pagesEl.innerHTML = data.pages.length
        ? data.pages.map((p) => `<a href="${p.url}" target="_blank" style="display:block; padding:7px 10px; background:#0d1117; border:1px solid #30363d; border-radius:6px; color:#58a6ff; text-decoration:none; font-size:12px; margin-bottom:5px; text-align:left;">🌐 ${p.name}</a>`).join("")
        : `<div style="font-size:12px; color:#8b949e; text-align:center;">No HTML pages found</div>`;
    };

    renderList();

    document.getElementById("gh-close-btn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.getElementById("gh-sync-btn").onclick = async () => {
      const btn = document.getElementById("gh-sync-btn");
      btn.disabled = true;
      btn.textContent = "⏳ Fetching Latest Commit...";
      await syncAndRun(false, true);
      renderList();
      btn.disabled = false;
      btn.textContent = "🔄 Sync & Update Now";
    };
  }

  if (!window.__gh_master_hotkey_ready__) {
    window.__gh_master_hotkey_ready__ = true;
    window.addEventListener("keydown", (e) => {
      if (e.altKey && (e.code === "KeyM" || e.key.toLowerCase() === "m" || e.key === "ة")) {
        e.preventDefault();
        toggleControlPanel();
      }
    });
  }

  syncAndRun(true, false);
});
