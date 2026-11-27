// @name Print ECG Patient Label
// @match https://apphiss1vi.moh.gov.sa/*

(function() {
  'use strict';

  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // Configuration
  const CHECK_INTERVAL = 2000;
  const LABEL_WIDTH = '50mm';
  const LABEL_HEIGHT = '25mm';

  // Capture required API headers from system requests
  const capturedHeaders = {};
  const skipHeaders = ['content-type', 'content-length', 'accept'];

  const origOpen = win.XMLHttpRequest.prototype.open;
  win.XMLHttpRequest.prototype.open = function(method, url) {
    this._reqUrl = url ? String(url) : '';
    return origOpen.apply(this, arguments);
  };

  const origSetHeader = win.XMLHttpRequest.prototype.setRequestHeader;
  win.XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (this._reqUrl && this._reqUrl.includes('/csi-api/')) {
      if (header && !skipHeaders.includes(header.toLowerCase())) {
        capturedHeaders[header] = value;
      }
    }
    return origSetHeader.apply(this, arguments);
  };

  // Extract mobile number from JSON response
  function extractPhoneFromJson(text) {
    if (!text) return 'N/A';

    const saudiMatch = text.match(/(?:\+?966|0)?5\d{8}/);
    if (saudiMatch) {
      let num = saudiMatch[0];
      if (num.startsWith('5') && num.length === 9) num = '0' + num;
      return num;
    }

    const keyMatch = text.match(/"(?:mobile|phone|contact|tel|cell)[^"]*"\s*:\s*"([^"]{7,15})"/i);
    if (keyMatch && keyMatch[1]) return keyMatch[1];

    return 'N/A';
  }

  // Fetch patient mobile number in the background using MRN
  async function fetchPatientMobile(mrn) {
    if (!mrn || mrn === 'N/A') return 'N/A';
    try {
      const headers = Object.assign({ 'Accept': 'application/json' }, capturedHeaders);
      const url = `/csi-api/csi-net-empiread/api/patient/${mrn}?lang=en&internationalization=true`;

      const res = await win.fetch(url, { method: 'GET', headers, credentials: 'include' });
      if (!res.ok) return 'N/A';

      const text = await res.text();
      return extractPhoneFromJson(text);
    } catch (err) {
      return 'N/A';
    }
  }

  // Query across both pinned and scrollable parts of an AG Grid row
  function queryInFullRow(rowElement, selector) {
    if (!rowElement) return null;
    const rowIndex = rowElement.getAttribute('row-index');
    if (rowIndex !== null) {
      const matchingRows = document.querySelectorAll(`[role="row"][row-index="${rowIndex}"]`);
      for (const r of matchingRows) {
        const found = r.querySelector(selector);
        if (found) return found;
      }
    }
    return rowElement.querySelector(selector);
  }

  // Escape HTML characters safely
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Print formatted patient details on 50x25mm thermal label
  function printPatientLabel(data, btn) {
    const oldFrame = document.getElementById('ngh-ecg-print-frame');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'ngh-ecg-print-frame';
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden'
    });
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ECG Label</title>
<style>
  @page {
    size: ${LABEL_WIDTH} ${LABEL_HEIGHT};
    margin: 0;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    width: ${LABEL_WIDTH};
    height: ${LABEL_HEIGHT};
    font-family: Arial, Tahoma, sans-serif;
    font-size: 7.5pt;
    line-height: 1.15;
    color: #000000;
    background: #ffffff;
    overflow: hidden;
  }
  .label-box {
    width: 100%;
    height: 100%;
    padding: 1mm 1.5mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .name-line {
    font-weight: bold;
    font-size: 7.2pt;
    line-height: 1.1;
    white-space: normal;
    word-break: break-word;
    margin-bottom: 0.5mm;
  }
  .line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bold {
    font-weight: bold;
  }
</style>
</head>
<body>
  <div class="label-box">
    <div class="name-line">Name: ${escapeHtml(data.name)}</div>
    <div class="line">ID: ${escapeHtml(data.id)}</div>
    <div class="line bold">MRN: ${escapeHtml(data.mrn)}</div>
    <div class="line">Age: ${escapeHtml(data.age)}</div>
    <div class="line">Mobile: ${escapeHtml(data.mobile)}</div>
  </div>
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        btn.innerText = '✓ Printed';
        btn.style.backgroundColor = '#28a745';
        btn.style.borderColor = '#1e7e34';
      } catch (err) {
        btn.innerText = '✕ Error';
      }

      setTimeout(() => {
        btn.innerText = '🖨️ ECG';
        btn.style.backgroundColor = '#0d6efd';
        btn.style.borderColor = '#0a58ca';
        btn.disabled = false;
      }, 1500);
    }, 150);
  }

  // Create styled clickable print button
  function createEcgButton(nameElement) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = '🖨️ ECG';
    btn.title = 'Print patient info on thermal printer';
    btn.className = 'custom-ecg-print-btn';

    Object.assign(btn.style, {
      marginRight: '8px',
      padding: '2px 7px',
      fontSize: '11px',
      cursor: 'pointer',
      backgroundColor: '#0d6efd',
      color: '#ffffff',
      border: '1px solid #0a58ca',
      borderRadius: '4px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
      fontWeight: 'bold',
      transition: 'background-color 0.15s, transform 0.1s',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      flexShrink: '0',
      zIndex: '10'
    });

    btn.addEventListener('mouseenter', () => {
      if (!btn.disabled) btn.style.backgroundColor = '#0b5ed7';
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn.disabled) btn.style.backgroundColor = '#0d6efd';
    });

    btn.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();

      btn.innerText = '...';
      btn.disabled = true;

      const row = nameElement.closest('[role="row"]');
      const fullNameAttr = nameElement.getAttribute('title');
      const patientName = (fullNameAttr && fullNameAttr.trim()) ? fullNameAttr.trim() : nameElement.textContent.trim();

      let patientId = 'N/A';
      let patientMrn = 'N/A';
      let patientAge = 'N/A';

      const idEl = queryInFullRow(row, 'span.patient_idnumber');
      if (idEl) {
        const match = idEl.textContent.match(/\d+/);
        if (match) patientId = match[0];
      }

      const mrnEl = queryInFullRow(row, 'span.patient_mrn');
      if (mrnEl) patientMrn = mrnEl.textContent.trim();

      const ageEl = queryInFullRow(row, 'div.patient_age');
      if (ageEl) patientAge = ageEl.textContent.trim();

      const patientMobile = await fetchPatientMobile(patientMrn);

      printPatientLabel({
        name: patientName,
        id: patientId,
        mrn: patientMrn,
        age: patientAge,
        mobile: patientMobile
      }, btn);
    });

    return btn;
  }

  // Inject buttons only inside the external ER patient list rows
  function injectEcgButtons() {
    if (window.location.href.includes('/patient/')) return;

    const nameElements = document.querySelectorAll('[role="row"] span.patient_name');

    nameElements.forEach(element => {
      if (element.hasAttribute('data-ecg-print-injected')) return;

      const ecgBtn = createEcgButton(element);
      element.parentNode.insertBefore(ecgBtn, element);
      element.setAttribute('data-ecg-print-injected', 'true');

      if (window.getComputedStyle(element.parentNode).display !== 'flex') {
        element.parentNode.style.display = 'flex';
        element.parentNode.style.alignItems = 'center';
      }
    });
  }

  setInterval(injectEcgButtons, CHECK_INTERVAL);

})();
