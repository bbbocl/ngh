// @name Auto Scan
// @match https://apphiss1vi.moh.gov.sa/er/*

(function () {
  'use strict';

  const TARGET_URL_PREFIX = 'https://apphiss1vi.moh.gov.sa/er/#/patient/';
  const BTN_ID = 'abdullah-floating-scan-btn';
  const STYLE_ID = 'abdullah-floating-scan-style';
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
    btn.textContent = 'SCANNING...';
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
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483646;
        min-width: 240px;
        padding: 10px 36px;
        background: linear-gradient(135deg, #0f766e, #0d9488);
        color: #ffffff;
        border: 2px solid #ffffff;
        border-radius: 10px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 16px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        transition: background 0.2s ease, transform 0.1s ease, opacity 0.2s ease, box-shadow 0.2s ease;
      }
      #${BTN_ID}:hover:not(:disabled) {
        background: linear-gradient(135deg, #115e59, #0f766e);
        transform: translateX(-50%) translateY(-1px);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
      }
      #${BTN_ID}:active:not(:disabled) {
        transform: translateX(-50%) translateY(0);
      }
      #${BTN_ID}:disabled {
        opacity: 0.75;
        cursor: wait;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function syncFloatingButton() {
    if (!document.body) return;

    const existingBtn = document.getElementById(BTN_ID);

    if (!isTargetRoute()) {
      if (existingBtn) existingBtn.remove();
      return;
    }

    injectStyles();
    if (existingBtn) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = 'AUTO SCAN';
    btn.title = 'Run automated document scan workflow';
    btn.addEventListener('click', () => runScanWorkflow(btn));
    document.body.appendChild(btn);
  }

  syncFloatingButton();

  window.addEventListener('hashchange', syncFloatingButton);
  window.addEventListener('popstate', syncFloatingButton);

  const observer = new MutationObserver(() => {
    syncFloatingButton();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
