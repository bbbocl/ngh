// @name API Request Inspector
// @match https://apphiss1vi.moh.gov.sa/*

(function() {
  'use strict';

  if (document.getElementById('ngh-api-inspector-box')) return;

  const capturedLogs = [];
  const sensitiveHeaders = ['authorization', 'cookie', 'x-xsrf-token', 'x-csrf-token', 'token'];

  // Inject styles safely without GM_addStyle
  const style = document.createElement('style');
  style.textContent = `
    #ngh-api-inspector-box {
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 380px;
      max-height: 440px;
      background: #1e1e2e;
      color: #cdd6f4;
      border: 1px solid #45475a;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      font-family: Consolas, Monaco, monospace;
      font-size: 12px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #ngh-api-header {
      background: #181825;
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #313244;
      font-weight: bold;
    }
    #ngh-api-actions {
      display: flex;
      gap: 6px;
    }
    .ngh-api-btn {
      background: #313244;
      color: #cdd6f4;
      border: 1px solid #45475a;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
    }
    .ngh-api-btn:hover {
      background: #45475a;
    }
    .ngh-api-btn-primary {
      background: #2563eb;
      border-color: #1d4ed8;
      color: #ffffff;
    }
    .ngh-api-btn-primary:hover {
      background: #1d4ed8;
    }
    #ngh-api-output {
      width: 100%;
      height: 320px;
      background: #11111b;
      color: #a6e3a1;
      border: none;
      padding: 10px;
      box-sizing: border-box;
      resize: vertical;
      font-family: Consolas, Monaco, monospace;
      font-size: 11px;
      line-height: 1.4;
      outline: none;
    }
    #ngh-api-status {
      padding: 5px 10px;
      background: #181825;
      border-top: 1px solid #313244;
      font-size: 11px;
      color: #9399b2;
    }
  `;
  document.head.appendChild(style);

  // Build floating UI panel
  const box = document.createElement('div');
  box.id = 'ngh-api-inspector-box';
  box.innerHTML = `
    <div id="ngh-api-header">
      <span>API Inspector (0)</span>
      <div id="ngh-api-actions">
        <button type="button" class="ngh-api-btn ngh-api-btn-primary" id="ngh-api-copy" title="Copy captured output">Copy</button>
        <button type="button" class="ngh-api-btn" id="ngh-api-clear" title="Clear captured logs">Clear</button>
        <button type="button" class="ngh-api-btn" id="ngh-api-toggle" title="Minimize or expand panel">_</button>
      </div>
    </div>
    <textarea id="ngh-api-output" readonly placeholder="Waiting for /csi-api/ requests... Click 'Reset Filter(s)' on the page."></textarea>
    <div id="ngh-api-status">Ready. Sensitive tokens are auto-masked.</div>
  `;
  document.body.appendChild(box);

  const headerTitle = box.querySelector('#ngh-api-header span');
  const outputArea = box.querySelector('#ngh-api-output');
  const statusText = box.querySelector('#ngh-api-status');
  const copyBtn = box.querySelector('#ngh-api-copy');
  const clearBtn = box.querySelector('#ngh-api-clear');
  const toggleBtn = box.querySelector('#ngh-api-toggle');

  let isMinimized = false;
  toggleBtn.addEventListener('click', () => {
    isMinimized = !isMinimized;
    outputArea.style.display = isMinimized ? 'none' : 'block';
    statusText.style.display = isMinimized ? 'none' : 'block';
    toggleBtn.textContent = isMinimized ? '+' : '_';
  });

  clearBtn.addEventListener('click', () => {
    capturedLogs.length = 0;
    outputArea.value = '';
    headerTitle.textContent = 'API Inspector (0)';
    statusText.textContent = 'Logs cleared.';
  });

  copyBtn.addEventListener('click', () => {
    const text = outputArea.value;
    if (!text) {
      statusText.textContent = 'Nothing to copy yet.';
      return;
    }

    const fallbackCopy = () => {
      outputArea.select();
      document.execCommand('copy');
      statusText.textContent = 'Copied to clipboard!';
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { statusText.textContent = 'Copied to clipboard!'; })
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  });

  // Mask sensitive tokens and extract structural JSON keys only
  function sanitizeHeaders(headersObj) {
    const clean = {};
    for (const key in headersObj) {
      if (Object.prototype.hasOwnProperty.call(headersObj, key)) {
        clean[key] = sensitiveHeaders.includes(key.toLowerCase()) ? '[REDACTED]' : headersObj[key];
      }
    }
    return clean;
  }

  function extractStructure(rawText) {
    if (!rawText) return 'Empty response';
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        const firstItemKeys = parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null
          ? Object.keys(parsed[0])
          : [];
        return `Array(${parsed.length}) | Item Keys: [${firstItemKeys.join(', ')}]`;
      }
      if (typeof parsed === 'object' && parsed !== null) {
        const topKeys = Object.keys(parsed);
        let nestedInfo = '';
        for (const k of topKeys) {
          if (Array.isArray(parsed[k]) && parsed[k].length > 0 && typeof parsed[k][0] === 'object') {
            nestedInfo += ` | ${k}[0] Keys: [${Object.keys(parsed[k][0]).join(', ')}]`;
          }
        }
        return `Object Keys: [${topKeys.join(', ')}]${nestedInfo}`;
      }
      return `Primitive (${typeof parsed})`;
    } catch (e) {
      return `Non-JSON (${rawText.length} chars)`;
    }
  }

  function recordRequest(entry) {
    capturedLogs.push(entry);
    headerTitle.textContent = `API Inspector (${capturedLogs.length})`;
    outputArea.value = capturedLogs.map((item, idx) => {
      return [
        `=== REQUEST #${idx + 1} ===`,
        `METHOD: ${item.method}`,
        `URL: ${item.url}`,
        `STATUS: ${item.status}`,
        `HEADERS: ${JSON.stringify(item.headers)}`,
        `BODY: ${item.body || 'None'}`,
        `RESPONSE SHAPE: ${item.responseShape}`
      ].join('\n');
    }).join('\n\n');
    outputArea.scrollTop = outputArea.scrollHeight;
    statusText.textContent = `Captured: ${entry.method} ${entry.url.split('?')[0]}`;
  }

  // Hook XMLHttpRequest
  const origOpen = window.XMLHttpRequest.prototype.open;
  const origSetHeader = window.XMLHttpRequest.prototype.setRequestHeader;
  const origSend = window.XMLHttpRequest.prototype.send;

  window.XMLHttpRequest.prototype.open = function(method, url) {
    this._nghMeta = {
      method: method ? String(method).toUpperCase() : 'GET',
      url: url ? String(url) : '',
      headers: {}
    };
    return origOpen.apply(this, arguments);
  };

  window.XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (this._nghMeta && header) {
      this._nghMeta.headers[header] = value;
    }
    return origSetHeader.apply(this, arguments);
  };

  window.XMLHttpRequest.prototype.send = function(body) {
    if (this._nghMeta && this._nghMeta.url.includes('/csi-api/')) {
      const meta = this._nghMeta;
      const reqBody = body ? String(body) : '';
      this.addEventListener('load', () => {
        recordRequest({
          method: meta.method,
          url: meta.url,
          status: this.status,
          headers: sanitizeHeaders(meta.headers),
          body: reqBody,
          responseShape: extractStructure(this.responseText)
        });
      });
    }
    return origSend.apply(this, arguments);
  };
})();
