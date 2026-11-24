// @name CSS Selector Picker
// @match *://*/*

(function () {
  'use strict';

  const STYLE_ID = 'abdullah-css-picker-style';
  const TOAST_ID = 'abdullah-css-picker-toast';
  let hoveredEl = null;
  let altPressed = false;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .abdullah-picker-highlight {
        outline: 2px dashed #10b981 !important;
        outline-offset: 2px !important;
        background-color: rgba(16, 185, 129, 0.14) !important;
        cursor: crosshair !important;
      }
      #${TOAST_ID} {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #10b981;
        padding: 12px 18px;
        border-radius: 10px;
        z-index: 2147483647;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        direction: ltr;
        text-align: left;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);
        max-width: 90vw;
        pointer-events: none;
      }
      #${TOAST_ID} code {
        display: block;
        margin-top: 6px;
        padding: 6px 8px;
        background: #1e293b;
        color: #34d399;
        border-radius: 6px;
        font-family: Consolas, monospace;
        font-size: 12px;
        word-break: break-all;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function clearHighlight() {
    if (hoveredEl) {
      hoveredEl.classList.remove('abdullah-picker-highlight');
      hoveredEl = null;
    }
  }

  function isValidStaticId(id) {
    if (!id) return false;
    if (/^(ng-|cdk-|mat-|b-|_ng|ember|react)/i.test(id)) return false;
    if (/\d{5,}/.test(id)) return false;
    return true;
  }

  function getCleanClasses(el) {
    if (!el.classList || !el.classList.length) return [];
    const ignoredPrefixes = ['ng-', 'cdk-', 'mat-', 'abdullah-picker'];
    const ignoredExact = ['active', 'show', 'focus', 'focused', 'hover', 'selected', 'open', 'disabled'];
    return Array.from(el.classList).filter((cls) => {
      if (ignoredExact.includes(cls)) return false;
      return !ignoredPrefixes.some((prefix) => cls.startsWith(prefix));
    });
  }

  function isUnique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (e) {
      return false;
    }
  }

  function buildCssSelector(target) {
    if (!target || target.nodeType !== 1) return '';

    if (isValidStaticId(target.id)) {
      const idSel = '#' + CSS.escape(target.id);
      if (isUnique(idSel)) return idSel;
    }

    const importantAttrs = ['formcontrolname', 'name', 'data-testid', 'data-test', 'aria-label', 'placeholder', 'title'];
    for (const attr of importantAttrs) {
      const val = target.getAttribute(attr);
      if (val && val.trim().length > 0 && val.trim().length < 60) {
        const attrSel = `${target.tagName.toLowerCase()}[${attr}="${CSS.escape(val.trim())}"]`;
        if (isUnique(attrSel)) return attrSel;
      }
    }

    const path = [];
    let current = target;

    while (current && current.nodeType === 1 && current.tagName.toLowerCase() !== 'html') {
      const tag = current.tagName.toLowerCase();

      if (isValidStaticId(current.id)) {
        path.unshift('#' + CSS.escape(current.id));
        const candidate = path.join(' > ');
        if (isUnique(candidate)) return candidate;
      }

      let segment = tag;
      const classes = getCleanClasses(current);
      if (classes.length > 0) {
        segment += '.' + classes.slice(0, 3).map((c) => CSS.escape(c)).join('.');
      }

      const parent = current.parentElement;
      if (parent) {
        const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current) + 1;
          segment += `:nth-of-type(${index})`;
        }
      }

      path.unshift(segment);
      const fullCandidate = path.join(' > ');
      if (isUnique(fullCandidate)) return fullCandidate;

      current = parent;
    }

    return path.join(' > ');
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    ta.remove();
    return ok;
  }

  function showToast(selector, infoLine) {
    const old = document.getElementById(TOAST_ID);
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.innerHTML = `
      <strong>Copied CSS Selector:</strong>
      <div style="font-size:11px; color:#94a3b8; margin-top:2px;">${infoLine}</div>
      <code>${selector}</code>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5000);
  }

  function getInteractiveTarget(el) {
    if (!el || el.nodeType !== 1) return null;
    const closestInteractive = el.closest('button, a, input, select, textarea, ng-select, [role="button"]');
    return closestInteractive || el;
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt') {
      altPressed = true;
      injectStyles();
    }
  }, true);

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') {
      altPressed = false;
      clearHighlight();
    }
  }, true);

  window.addEventListener('blur', () => {
    altPressed = false;
    clearHighlight();
  });

  document.addEventListener('mouseover', (e) => {
    if (!e.altKey && !altPressed) {
      clearHighlight();
      return;
    }
    injectStyles();
    const target = getInteractiveTarget(e.target);
    if (target && target !== hoveredEl) {
      clearHighlight();
      hoveredEl = target;
      hoveredEl.classList.add('abdullah-picker-highlight');
    }
  }, true);

  ['mousedown', 'mouseup'].forEach((evtName) => {
    document.addEventListener(evtName, (e) => {
      if (e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }, true);
  });

  document.addEventListener('click', async (e) => {
    if (!e.altKey) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    injectStyles();
    const target = getInteractiveTarget(e.target);
    if (!target) return;

    const cssSelector = buildCssSelector(target);
    const tag = target.tagName.toLowerCase();
    const text = (target.innerText || target.value || target.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const infoLine = `Tag: ${tag}${text ? ` | Label: "${text}"` : ''}`;

    const payload = `CSS: ${cssSelector}\nInfo: ${infoLine}`;
    await copyToClipboard(payload);
    showToast(cssSelector, infoLine);
  }, true);
})();
