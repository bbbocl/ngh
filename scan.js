// @name Auto Scan
// @match https://apphiss1vi.moh.gov.sa/er/*

(function () {
  'use strict';

  const TARGET_URL_PREFIX = 'https://apphiss1vi.moh.gov.sa/er/#/patient/';
  const BTN_ID = 'abdullah-inline-scan-btn';
  const STYLE_ID = 'abdullah-inline-scan-style';
  let isRunning = false;

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const isTargetRoute = () => window.location.href.startsWith(TARGET_URL_PREFIX);

  const realClick = (selector, name) => {
    const el = document.querySelector(selector);
    if (el) {
      ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((evt) =>
        el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }))
      );
      return true;
    }
    alert('Error: ' + name);
    return false;
  };

  const clickByText = (selector, textToFind, name) => {
    const elements = document.querySelectorAll(selector);
    for (let el of elements) {
      if (el.textContent.includes(textToFind)) {
        ['mousedown', 'mouseup', 'click'].forEach((evt) =>
          el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }))
        );
        return true;
      }
    }
    alert('Error: ' + name + ' (Text not found)');
    return false;
  };

  const selectNgOptionByText = async (selectIndex, optionText, name) => {
    const ngInputs = document.querySelectorAll('ng-select input');
    if (ngInputs.length > selectIndex) {
      ['mousedown', 'mouseup', 'click'].forEach((evt) =>
        ngInputs[selectIndex].dispatchEvent(new MouseEvent(evt, { bubbles: true }))
      );
      await delay(1500);
      const options = document.querySelectorAll('.ng-option');
      for (let opt of options) {
        if (opt.textContent.toLowerCase().includes(optionText.toLowerCase())) {
          ['mousedown', 'mouseup', 'click'].forEach((evt) =>
            opt.dispatchEvent(new MouseEvent(evt, { bubbles: true }))
          );
          return true;
        }
      }
      alert('Error: Option "' + optionText + '" not found in ' + name);
      return false;
    } else {
      alert('Error: Dropdown ' + name + ' not found');
      return false;
    }
  };

  async function runScanWorkflow(btn) {
    if (isRunning || !isTargetRoute()) return;
    isRunning = true;
    const originalText = btn.textContent;
    btn.textContent = 'Scanning...';
    btn.disabled = true;

    try {
      if (!realClick('.shortcuts-btn', '3 Dots Menu')) return;
      await delay(1500);

      if (!clickByText('.shortcuts-menu-item-type', 'Scan Documents', 'Scan Dec Menu')) return;
      await delay(3000);

      if (
        !realClick(
          'html>body.csi_body.white-light.patient_body.modal-open>modal-container.modal.fade.show>div.modal-dialog.nova-modal.modal-lg.request-for-circumstances-of-death-form-police-modal>div.modal-content>app-er-dms-popup>div.csi-nova.nova-facelift>div.nova-modal__body:nth-of-type(2)>div>div:nth-of-type(1)>div.nova-btn-row.mb-2>button.nova-btn.nova-btn--secondary.nova-btn--md:nth-of-type(2)',
          'Scan Form'
        )
      )
        return;
      await delay(1000);

      if (!realClick('#openSanner', 'Proceed 1')) return;
      await delay(3000);

      if (!(await selectNgOptionByText(1, 'wia-fi-7260', 'Scanner Source Menu'))) return;
      await delay(1000);

      if (!(await selectNgOptionByText(2, 'very high', 'Scan Quality Menu'))) return;
      await delay(1000);

      if (!realClick('.nova-btn-row:nth-of-type(9) button', 'Scan Button')) return;
      await delay(8000);

      if (
        !realClick(
          'app-dashboard-scan>div>div.nova-modal__body>csi-scanner>div>div.row>div.col-md-4>div:nth-child(1)>button',
          'Proceed to Upload'
        )
      )
        return;
      await delay(3000);

      const categoryMenu = document.querySelector('#changeAttribute');
      if (categoryMenu) {
        categoryMenu.value = categoryMenu.options[4].value;
        categoryMenu.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        alert('Error: Category Menu');
        return;
      }
      await delay(1000);

      const typeMenu = document.querySelectorAll('#changeAttribute')[1];
      if (typeMenu) {
        typeMenu.value = typeMenu.options[3].value;
        typeMenu.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await delay(1000);

      if (!realClick('#upload-files', 'Upload')) return;

      const t = document.createElement('div');
      t.textContent = 'By tech Abdullah';
      Object.assign(t.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        background: 'rgba(0,0,0,0.85)',
        color: '#fff',
        padding: '20px 40px',
        borderRadius: '10px',
        zIndex: '2147483647',
        fontSize: '24px',
        fontWeight: 'bold',
        pointerEvents: 'none'
      });
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 10000);
    } catch (e) {
      alert('Error');
    } finally {
      isRunning = false;
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BTN_ID} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background-color: #16a34a !important;
        color: #ffffff !important;
        border: none !important;
        border-radius: 9999px !important;
        padding: 6px 16px;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.4;
        white-space: nowrap;
        cursor: pointer;
        vertical-align: middle;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
        transition: background-color 0.15s ease, opacity 0.15s ease;
      }
      #${BTN_ID}:hover:not(:disabled) {
        background-color: #15803d !important;
      }
      #${BTN_ID}:active:not(:disabled) {
        background-color: #166534 !important;
      }
      #${BTN_ID}:disabled {
        opacity: 0.7;
        cursor: wait;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function findInsertionTarget() {
    const shortcutsBtn = document.querySelector('.shortcuts-btn');
    if (!shortcutsBtn) return null;

    // Walk up from .shortcuts-btn until we find the element whose previous sibling is the Discharge button
    let anchor = shortcutsBtn;
    while (anchor && anchor.parentElement && anchor.parentElement !== document.body) {
      const prev = anchor.previousElementSibling;
      if (prev && (prev.tagName === 'BUTTON' || prev.querySelector('button'))) {
        return { container: anchor.parentElement, beforeNode: anchor, referenceBtn: prev };
      }
      anchor = anchor.parentElement;
    }

    // Fallback: insert directly before .shortcuts-btn
    return {
      container: shortcutsBtn.parentElement,
      beforeNode: shortcutsBtn,
      referenceBtn: shortcutsBtn.previousElementSibling
    };
  }

  function syncInlineButton() {
    if (!document.body) return;

    const existingBtn = document.getElementById(BTN_ID);

    if (!isTargetRoute()) {
      if (existingBtn) existingBtn.remove();
      return;
    }

    injectStyles();

    const target = findInsertionTarget();
    if (!target || !target.container) return;

    // Avoid duplicate injection if already placed right before the 3-dots container
    if (existingBtn && existingBtn.nextElementSibling === target.beforeNode) return;
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = 'Auto Scan';
    btn.title = 'Run automated document scan workflow';

    // Match exact height, font, and spacing of the adjacent Discharge/Admission pill button
    const refButton =
      target.referenceBtn && target.referenceBtn.tagName === 'BUTTON'
        ? target.referenceBtn
        : target.referenceBtn?.querySelector('button');

    if (refButton) {
      const cs = window.getComputedStyle(refButton);
      btn.style.height = cs.height;
      btn.style.padding = cs.padding;
      btn.style.fontSize = cs.fontSize;
      btn.style.fontWeight = cs.fontWeight;
      btn.style.fontFamily = cs.fontFamily;
      btn.style.marginLeft = cs.marginLeft !== '0px' ? cs.marginLeft : '6px';
      btn.style.marginRight = cs.marginRight !== '0px' ? cs.marginRight : '6px';
    } else {
      btn.style.margin = '0 6px';
    }

    btn.addEventListener('click', () => runScanWorkflow(btn));
    target.container.insertBefore(btn, target.beforeNode);
  }

  syncInlineButton();

  window.addEventListener('hashchange', syncInlineButton);
  window.addEventListener('popstate', syncInlineButton);

  const observer = new MutationObserver(() => {
    syncInlineButton();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
