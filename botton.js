// @name Floating ntfy Spec Sender
// @match *://*/*

(function () {
  'use strict';

  const ROOT_ID = 'abdullah-ntfy-collector-root';
  const STYLE_ID = 'abdullah-ntfy-collector-style';
  const POS_KEY = 'abdullah_ntfy_btn_pos';
  const DRAFT_KEY = 'abdullah_ntfy_draft_text';
  const NTFY_TOPIC_URL = 'https://ntfy.sh/bbocl';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        z-index: 2147483646;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        direction: ltr;
        text-align: left;
      }
      #${ROOT_ID} .ntfy-fab {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #0f766e;
        color: #ffffff;
        border: 1px solid #14b8a6;
        border-radius: 999px;
        padding: 9px 15px;
        font-size: 13px;
        font-weight: 700;
        cursor: grab;
        user-select: none;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        transition: background 0.15s ease, transform 0.1s ease;
      }
      #${ROOT_ID} .ntfy-fab:hover {
        background: #115e59;
      }
      #${ROOT_ID} .ntfy-fab:active {
        cursor: grabbing;
      }
      #${ROOT_ID} .ntfy-panel {
        width: 380px;
        max-width: 92vw;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 12px;
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.55);
        overflow: hidden;
        display: none;
        flex-direction: column;
      }
      #${ROOT_ID}.is-open .ntfy-fab {
        display: none;
      }
      #${ROOT_ID}.is-open .ntfy-panel {
        display: flex;
      }
      #${ROOT_ID} .ntfy-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #1e293b;
        border-bottom: 1px solid #334155;
        cursor: grab;
        user-select: none;
      }
      #${ROOT_ID} .ntfy-header:active {
        cursor: grabbing;
      }
      #${ROOT_ID} .ntfy-title {
        font-size: 13px;
        font-weight: 700;
        color: #38bdf8;
      }
      #${ROOT_ID} .ntfy-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #${ROOT_ID} .ntfy-icon-btn {
        background: #334155;
        color: #e2e8f0;
        border: none;
        border-radius: 6px;
        padding: 4px 9px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      #${ROOT_ID} .ntfy-icon-btn:hover {
        background: #475569;
      }
      #${ROOT_ID} .ntfy-toolbar {
        display: flex;
        gap: 6px;
        padding: 10px 12px 0;
        flex-wrap: wrap;
      }
      #${ROOT_ID} .ntfy-chip-btn {
        background: #1e293b;
        color: #cbd5e1;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
      }
      #${ROOT_ID} .ntfy-chip-btn:hover {
        border-color: #38bdf8;
        color: #ffffff;
      }
      #${ROOT_ID} .ntfy-body {
        padding: 10px 12px;
      }
      #${ROOT_ID} .ntfy-textarea {
        width: 100%;
        height: 230px;
        box-sizing: border-box;
        background: #020617;
        color: #f1f5f9;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 10px;
        font-family: Consolas, Monaco, monospace;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre;
        overflow-wrap: normal;
        overflow-x: auto;
        resize: vertical;
        outline: none;
      }
      #${ROOT_ID} .ntfy-textarea:focus {
        border-color: #14b8a6;
      }
      #${ROOT_ID} .ntfy-footer {
        padding: 0 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #${ROOT_ID} .ntfy-send-btn {
        width: 100%;
        padding: 10px;
        background: #059669;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      #${ROOT_ID} .ntfy-send-btn:hover:not(:disabled) {
        background: #047857;
      }
      #${ROOT_ID} .ntfy-send-btn:disabled {
        opacity: 0.65;
        cursor: wait;
      }
      #${ROOT_ID} .ntfy-status {
        font-size: 11px;
        color: #94a3b8;
        text-align: center;
        min-height: 15px;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function clampPosition(left, top, elWidth, elHeight) {
    const maxLeft = Math.max(8, window.innerWidth - elWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - elHeight - 8);
    return {
      left: Math.min(Math.max(8, left), maxLeft),
      top: Math.min(Math.max(8, top), maxTop)
    };
  }

  function applySavedPosition(root) {
    const saved = GM_getValue(POS_KEY, null);
    if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
      const clamped = clampPosition(saved.left, saved.top, 140, 44);
      root.style.left = clamped.left + 'px';
      root.style.top = clamped.top + 'px';
    } else {
      root.style.left = '20px';
      root.style.top = '80px';
    }
  }

  function makeDraggable(root, handle, onClickWithoutDrag) {
    let isDragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button')) return;
      isDragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = root.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        moved = true;
      }
      const rect = root.getBoundingClientRect();
      const clamped = clampPosition(origLeft + dx, origTop + dy, rect.width, rect.height);
      root.style.left = clamped.left + 'px';
      root.style.top = clamped.top + 'px';
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      const rect = root.getBoundingClientRect();
      GM_setValue(POS_KEY, { left: Math.round(rect.left), top: Math.round(rect.top) });
      if (!moved && typeof onClickWithoutDrag === 'function') {
        onClickWithoutDrag();
      }
    });
  }

  function sendToNtfy(messageText, sendBtn, statusEl) {
    if (!messageText || !messageText.trim()) {
      statusEl.style.color = '#f87171';
      statusEl.textContent = 'Text box is empty.';
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    statusEl.style.color = '#94a3b8';
    statusEl.textContent = 'Sending formatted text to ntfy/bbocl...';

    // Normalize line endings while strictly preserving all blank lines and spaces
    const normalizedPayload = messageText.replace(/\r\n/g, '\n');

    GM_xmlhttpRequest({
      method: 'POST',
      url: NTFY_TOPIC_URL,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': 'Script CSS & Instructions'
      },
      data: normalizedPayload,
      onload: (res) => {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to ntfy (bbocl)';
        if (res.status >= 200 && res.status < 300) {
          statusEl.style.color = '#34d399';
          statusEl.textContent = 'Sent successfully to ntfy.sh/bbocl!';
        } else {
          statusEl.style.color = '#f87171';
          statusEl.textContent = 'Send failed (HTTP ' + res.status + ')';
        }
      },
      onerror: () => {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to ntfy (bbocl)';
        statusEl.style.color = '#f87171';
        statusEl.textContent = 'Network error while sending to ntfy.';
      }
    });
  }

  function insertAtCursor(textarea, snippet) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const prefix = start > 0 && current[start - 1] !== '\n' ? '\n' : '';
    const insertion = prefix + snippet;
    textarea.value = current.slice(0, start) + insertion + current.slice(end);
    const newPos = start + insertion.length;
    textarea.selectionStart = newPos;
    textarea.selectionEnd = newPos;
    textarea.focus();
    GM_setValue(DRAFT_KEY, textarea.value);
  }

  function ensureCollectorWidget() {
    if (!document.body) return;
    injectStyles();
    if (document.getElementById(ROOT_ID)) return;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    applySavedPosition(root);

    root.innerHTML = `
      <div class="ntfy-fab" title="Drag to move, click to open">
        <span>CSS / ntfy</span>
      </div>
      <div class="ntfy-panel">
        <div class="ntfy-header" title="Drag header to move">
          <span class="ntfy-title">ntfy Sender (bbocl)</span>
          <div class="ntfy-header-actions">
            <button type="button" class="ntfy-icon-btn ntfy-min-btn" title="Minimize">_</button>
          </div>
        </div>
        <div class="ntfy-toolbar">
          <button type="button" class="ntfy-chip-btn ntfy-add-url-btn" title="Insert current page URL">+ Current URL</button>
          <button type="button" class="ntfy-chip-btn ntfy-add-sep-btn" title="Insert separator line">+ Separator</button>
          <button type="button" class="ntfy-chip-btn ntfy-clear-btn" title="Clear text">Clear</button>
        </div>
        <div class="ntfy-body">
          <textarea class="ntfy-textarea" spellcheck="false" placeholder="Target URL:&#10;https://...&#10;&#10;CSS Selector 1:&#10;#example-btn&#10;Instruction: Click this button first&#10;&#10;CSS Selector 2:&#10;.input-field&#10;Instruction: Fill patient ID"></textarea>
        </div>
        <div class="ntfy-footer">
          <button type="button" class="ntfy-send-btn">Send to ntfy (bbocl)</button>
          <div class="ntfy-status"></div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const fab = root.querySelector('.ntfy-fab');
    const header = root.querySelector('.ntfy-header');
    const minBtn = root.querySelector('.ntfy-min-btn');
    const addUrlBtn = root.querySelector('.ntfy-add-url-btn');
    const addSepBtn = root.querySelector('.ntfy-add-sep-btn');
    const clearBtn = root.querySelector('.ntfy-clear-btn');
    const textarea = root.querySelector('.ntfy-textarea');
    const sendBtn = root.querySelector('.ntfy-send-btn');
    const statusEl = root.querySelector('.ntfy-status');

    // Restore saved draft if available
    const savedDraft = GM_getValue(DRAFT_KEY, '');
    if (savedDraft) {
      textarea.value = savedDraft;
    }

    textarea.addEventListener('input', () => {
      GM_setValue(DRAFT_KEY, textarea.value);
    });

    const openPanel = () => {
      root.classList.add('is-open');
      const rect = root.getBoundingClientRect();
      const clamped = clampPosition(rect.left, rect.top, 380, 360);
      root.style.left = clamped.left + 'px';
      root.style.top = clamped.top + 'px';
      textarea.focus();
    };

    const minimizePanel = () => {
      root.classList.remove('is-open');
      statusEl.textContent = '';
    };

    makeDraggable(root, fab, openPanel);
    makeDraggable(root, header, null);

    minBtn.addEventListener('click', minimizePanel);

    addUrlBtn.addEventListener('click', () => {
      insertAtCursor(textarea, `URL: ${window.location.href}\n\n`);
    });

    addSepBtn.addEventListener('click', () => {
      insertAtCursor(textarea, `\n--------------------\n`);
    });

    clearBtn.addEventListener('click', () => {
      textarea.value = '';
      GM_setValue(DRAFT_KEY, '');
      statusEl.textContent = '';
      textarea.focus();
    });

    sendBtn.addEventListener('click', () => {
      sendToNtfy(textarea.value, sendBtn, statusEl);
    });
  }

  ensureCollectorWidget();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(ROOT_ID)) {
      ensureCollectorWidget();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
