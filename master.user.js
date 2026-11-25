// ==UserScript==
// @name         GitHub Master Script Manager
// @namespace    https://github.com/bbbocl/ngh
// @version      1.4
// @description  Cloud userscript manager via jsDelivr (Press Alt + M to open panel)
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addElement
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  const GITHUB_USER = "bbbocl";
  const GITHUB_REPO = "ngh";
  const BRANCH = "main";
  const FOLDER_PATH = "";

  const STORAGE_KEY = "gh_master_enabled_scripts";
  const CACHE_KEY = "gh_master_cached_files";

  const basePath = FOLDER_PATH ? `${FOLDER_PATH}/` : "";
  const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${BRANCH}/${basePath}`;
  const PURGE_BASE = `https://purge.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${BRANCH}/${basePath}`;

  function fetchUrl(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText);
          else reject(new Error("HTTP " + res.status));
        },
        onerror: () => reject(new Error("Network error"))
      });
    });
  }

  // Purge jsDelivr CDN cache on manual sync so updates appear immediately
  function purgeCdnFile(relativeFile) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: `${PURGE_BASE}${relativeFile}?t=${Date.now()}`,
        onload: () => resolve(),
        onerror: () => resolve()
      });
    });
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

  // Bridge to support GM_xmlhttpRequest inside injected scripts (e.g. ntfy notifications)
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

  // Inject script safely using GM_addElement (MV3 & CSP compatible)
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

  async function syncAndRun(runScripts = true, forcePurge = false) {
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
      if (forcePurge) {
        await purgeCdnFile("scripts.json");
      }

      const manifestRaw = await fetchUrl(`${CDN_BASE}scripts.json`);
      const manifest = JSON.parse(manifestRaw);

      const scriptNames = Array.isArray(manifest.scripts) ? manifest.scripts : [];
      const pageNames = Array.isArray(manifest.pages) ? manifest.pages : [];

      const updatedScripts = [];
      let mapChanged = false;

      for (const fileName of scriptNames) {
        if (!fileName || !fileName.endsWith(".js") || fileName === "master.user.js") continue;

        if (forcePurge) {
          await purgeCdnFile(fileName);
        }

        const code = await fetchUrl(`${CDN_BASE}${fileName}`);
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

        updatedScripts.push({
          fileName,
          displayName,
          matches,
          code
        });
      }

      const htmlFiles = pageNames.map((pName) => ({
        name: pName,
        url: `https://${GITHUB_USER}.github.io/${GITHUB_REPO}/${basePath}${pName}`
      }));

      if (mapChanged) GM_setValue(STORAGE_KEY, enabledMap);

      cachedData = {
        scripts: updatedScripts,
        pages: htmlFiles,
        lastSync: new Date().toLocaleTimeString("en-US")
      };
      GM_setValue(CACHE_KEY, cachedData);
      return cachedData;
    } catch (e) {
      console.warn("[MasterRunner] jsDelivr sync failed, using cached scripts:", e.message);
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
        🔄 Sync & Update (jsDelivr)
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
      document.getElementById("gh-status").textContent = "Purging cache & syncing...";
      await syncAndRun(false, true);
      renderList();
    };
  }

  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.code === "KeyM" || e.key.toLowerCase() === "m" || e.key === "ة")) {
      e.preventDefault();
      toggleControlPanel();
    }
  });

  syncAndRun(true, false);
})();
