// ==UserScript==
// @name         GitHub Master Script Manager
// @namespace    https://github.com/bbbocl/ngh
// @version      1.2
// @description  Cloud userscript manager (Press Alt + M to open panel)
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
  const FOLDER_PATH = "";

  const STORAGE_KEY = "gh_master_enabled_scripts";
  const CACHE_KEY = "gh_master_cached_files";

  function fetchUrl(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText);
          else reject(new Error("HTTP " + res.status));
        },
        onerror: () => reject(new Error("Failed to connect to GitHub"))
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

  async function syncAndRun(runScripts = true) {
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
      const pathSegment = FOLDER_PATH ? `/${FOLDER_PATH}` : "";
      const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents${pathSegment}`;
      const rawJson = await fetchUrl(apiUrl);
      const items = JSON.parse(rawJson);

      if (!Array.isArray(items)) return cachedData;

      const jsFiles = items.filter(
        (f) => f.type === "file" && f.name.endsWith(".js") && f.name !== "master.user.js"
      );

      const htmlFiles = items
        .filter((f) => f.type === "file" && f.name.endsWith(".html"))
        .map((f) => ({
          name: f.name,
          url: `https://${GITHUB_USER}.github.io/${GITHUB_REPO}${pathSegment}/${f.name}`
        }));

      const updatedScripts = [];
      let mapChanged = false;

      for (const file of jsFiles) {
        const code = await fetchUrl(file.download_url);
        const nameMatch = code.match(/\/\/\s*@name\s+(.+)/);
        const displayName = nameMatch ? nameMatch[1].trim() : file.name;
        const matches = [...code.matchAll(/\/\/\s*@match\s+(.+)/g)].map((m) => m[1].trim());

        if (!(file.name in enabledMap)) {
          enabledMap[file.name] = false;
          mapChanged = true;
        }

        updatedScripts.push({
          fileName: file.name,
          displayName,
          matches,
          code
        });
      }

      if (mapChanged) GM_setValue(STORAGE_KEY, enabledMap);

      cachedData = { scripts: updatedScripts, pages: htmlFiles, lastSync: new Date().toLocaleTimeString("en-US") };
      GM_setValue(CACHE_KEY, cachedData);
      return cachedData;
    } catch (e) {
      console.warn("[MasterRunner] GitHub sync failed, using cached scripts:", e.message);
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
      display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; direction: rtl;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      width: 380px; max-height: 80vh; overflow-y: auto; background: #161b22; color: #e6edf3;
      border: 1px solid #30363d; border-radius: 12px; padding: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);
    `;

    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <strong style="font-size:15px;">⚙️ إدارة السكربتات السحابية</strong>
        <button id="gh-close-btn" style="background:none; border:none; color:#8b949e; font-size:18px; cursor:pointer;">✖</button>
      </div>
      <button id="gh-sync-btn" style="width:100%; padding:9px; background:#238636; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-bottom:8px;">
        🔄 مزامنة وتحديث القائمة من GitHub
      </button>
      <div id="gh-status" style="font-size:11px; color:#8b949e; text-align:center; margin-bottom:12px;"></div>
      <div style="font-size:12px; color:#8b949e; border-bottom:1px solid #30363d; padding-bottom:4px; margin-bottom:8px;">السكربتات المتوفرة (JS)</div>
      <div id="gh-scripts-list"></div>
      <div style="font-size:12px; color:#8b949e; border-bottom:1px solid #30363d; padding-bottom:4px; margin:12px 0 8px;">الصفحات (HTML)</div>
      <div id="gh-pages-list"></div>
      <div style="font-size:11px; color:#8b949e; text-align:center; margin-top:12px;">أعد تحميل الصفحة (F5) بعد تفعيل أو إيقاف أي سكربت</div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const renderList = () => {
      const enabledMap = GM_getValue(STORAGE_KEY, {});
      const data = GM_getValue(CACHE_KEY, { scripts: [], pages: [], lastSync: "-" });
      document.getElementById("gh-status").textContent = `آخر مزامنة: ${data.lastSync || "-"}`;

      const listEl = document.getElementById("gh-scripts-list");
      if (!data.scripts.length) {
        listEl.innerHTML = `<div style="font-size:12px; color:#8b949e; text-align:center; padding:8px;">لا توجد ملفات JS بعد</div>`;
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
            <div style="overflow:hidden;">
              <div style="font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.displayName}</div>
              <div style="font-size:10px; color:#8b949e; direction:ltr; text-align:right;">${s.fileName}</div>
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
        ? data.pages.map((p) => `<a href="${p.url}" target="_blank" style="display:block; padding:7px 10px; background:#0d1117; border:1px solid #30363d; border-radius:6px; color:#58a6ff; text-decoration:none; font-size:12px; margin-bottom:5px;">🌐 ${p.name}</a>`).join("")
        : `<div style="font-size:12px; color:#8b949e; text-align:center;">لا توجد صفحات HTML</div>`;
    };

    renderList();

    document.getElementById("gh-close-btn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.getElementById("gh-sync-btn").onclick = async () => {
      document.getElementById("gh-status").textContent = "جاري السحب من GitHub...";
      await syncAndRun(false);
      renderList();
    };
  }

  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.code === "KeyM" || e.key.toLowerCase() === "m" || e.key === "ة")) {
      e.preventDefault();
      toggleControlPanel();
    }
  });

  syncAndRun(true);
})();
