// ==UserScript==
// @name         GitHub Master Script Manager
// @namespace    https://github.com/bbbocl/ngh
// @version      2.1
// @description  Permanent auto-updating bootloader for bbbocl/ngh (Alt + M)
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addElement
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    GITHUB_USER: "bbbocl",
    GITHUB_REPO: "ngh",
    BRANCH: "main",
    FOLDER_PATH: ""
  };

  const CORE_CACHE_KEY = "gh_master_core_code_v2";
  const STORE_BLOB_KEY = "gh_master_store_blob_v2";
  const basePath = CONFIG.FOLDER_PATH ? `${CONFIG.FOLDER_PATH}/` : "";

  function fetchRaw(url) {
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

  // Bridge GM_xmlhttpRequest to page context
  window.addEventListener("__gh_gm_xhr__", (e) => {
    let payload = e.detail;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (err) { return; }
    }
    const { id, details } = payload || {};
    if (!id || !details) return;

    GM_xmlhttpRequest({
      method: details.method || "GET",
      url: details.url,
      headers: details.headers,
      data: details.data,
      onload: (res) => {
        window.dispatchEvent(new CustomEvent("__gh_gm_xhr_res_" + id, {
          detail: JSON.stringify({ ok: true, status: res.status, responseText: res.responseText })
        }));
      },
      onerror: () => {
        window.dispatchEvent(new CustomEvent("__gh_gm_xhr_res_" + id, {
          detail: JSON.stringify({ ok: false })
        }));
      }
    });
  });

  // Bridge GM_addElement to bypass strict page CSP
  window.addEventListener("__gh_gm_add_el__", (e) => {
    let payload = e.detail;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (err) { return; }
    }
    if (!payload || !payload.tag) return;
    if (typeof GM_addElement === "function") {
      GM_addElement(document.head || document.documentElement, payload.tag, payload.attrs || {});
    }
  });

  // Bridge GM_setValue persistence
  window.addEventListener("__gh_gm_set__", (e) => {
    try {
      const { k, v } = JSON.parse(e.detail);
      const blob = GM_getValue(STORE_BLOB_KEY, {});
      blob[k] = v;
      GM_setValue(STORE_BLOB_KEY, blob);
    } catch (err) {}
  });

  function bootCore(code, activeRef) {
    if (!code || window.__gh_core_booted__) return;
    window.__gh_core_booted__ = true;

    const initialBlob = GM_getValue(STORE_BLOB_KEY, {});
    if (!initialBlob.gh_master_enabled_scripts) {
      const legacyEnabled = GM_getValue("gh_master_enabled_scripts", null);
      if (legacyEnabled) initialBlob.gh_master_enabled_scripts = legacyEnabled;
    }

    const bootstrapper = `(function(){
      if (window.__gh_page_core_active__) return;
      window.__gh_page_core_active__ = true;
      const __store = ${JSON.stringify(initialBlob)};
      const ctx = {
        GITHUB_USER: ${JSON.stringify(CONFIG.GITHUB_USER)},
        GITHUB_REPO: ${JSON.stringify(CONFIG.GITHUB_REPO)},
        BRANCH: ${JSON.stringify(CONFIG.BRANCH)},
        FOLDER_PATH: ${JSON.stringify(CONFIG.FOLDER_PATH)},
        activeRef: ${JSON.stringify(activeRef)},
        GM_getValue: function(k, d) { return Object.prototype.hasOwnProperty.call(__store, k) ? __store[k] : d; },
        GM_setValue: function(k, v) {
          __store[k] = v;
          window.dispatchEvent(new CustomEvent("__gh_gm_set__", { detail: JSON.stringify({ k: k, v: v }) }));
        },
        GM_xmlhttpRequest: function(details) {
          const id = Math.random().toString(36).slice(2);
          window.addEventListener("__gh_gm_xhr_res_" + id, function handler(ev) {
            window.removeEventListener("__gh_gm_xhr_res_" + id, handler);
            let res = ev.detail;
            if (typeof res === "string") { try { res = JSON.parse(res); } catch(e) {} }
            if (res && res.ok && typeof details.onload === "function") details.onload(res);
            else if (typeof details.onerror === "function") details.onerror(res);
          });
          window.dispatchEvent(new CustomEvent("__gh_gm_xhr__", {
            detail: JSON.stringify({ id: id, details: { method: details.method || "GET", url: details.url, headers: details.headers, data: details.data } })
          }));
        },
        GM_addElement: function(parent, tag, attrs) {
          window.dispatchEvent(new CustomEvent("__gh_gm_add_el__", { detail: JSON.stringify({ tag: tag, attrs: attrs }) }));
        }
      };
      (${code})(ctx);
    })();`;

    if (typeof GM_addElement === "function") {
      GM_addElement(document.head || document.documentElement, "script", { textContent: bootstrapper });
    } else {
      const s = document.createElement("script");
      s.textContent = bootstrapper;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    }
  }

  (async function init() {
    const cachedCore = GM_getValue(CORE_CACHE_KEY, "");
    if (cachedCore) {
      bootCore(cachedCore, CONFIG.BRANCH);
    }

    try {
      let ref = CONFIG.BRANCH;
      try {
        const res = await fetchRaw(`https://data.jsdelivr.com/v1/package/resolve/gh/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}@${CONFIG.BRANCH}`);
        const parsed = JSON.parse(res);
        if (parsed && parsed.version) ref = parsed.version;
      } catch (e) {}

      const freshCore = await fetchRaw(`https://cdn.jsdelivr.net/gh/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}@${ref}/${basePath}core.js`);
      if (freshCore && freshCore.includes("toggleControlPanel")) {
        GM_setValue(CORE_CACHE_KEY, freshCore);
        if (!window.__gh_core_booted__) {
          bootCore(freshCore, ref);
        }
      }
    } catch (e) {
      console.warn("[MasterBootloader] Background core check failed:", e.message);
    }
  })();
})();
