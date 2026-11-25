// ==UserScript==
// @name         GitHub Master Script Manager
// @namespace    https://github.com/bbbocl/ngh
// @version      2.0
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

  function bootCore(code, activeRef) {
    if (!code || window.__gh_core_booted__) return;
    try {
      const fn = new Function("ctx", `return (${code})(ctx);`);
      fn({
        ...CONFIG,
        activeRef,
        GM_xmlhttpRequest,
        GM_getValue,
        GM_setValue,
        GM_addElement
      });
      window.__gh_core_booted__ = true;
    } catch (e) {
      console.error("[MasterBootloader] Core execution failed:", e);
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
