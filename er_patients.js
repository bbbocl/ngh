// @name Auto ER Patient Monitor
// @match https://apphiss1vi.moh.gov.sa/*

(function() {
  'use strict';

  if (window.__nghAutoPatientRunning) return;
  window.__nghAutoPatientRunning = true;

  // Configuration
  const NTFY_TOPIC = 'pat_ngh';
  const API_POLL_INTERVAL = 12000;
  const RESET_BTN_INTERVAL = 15000;
  const DOM_SCAN_INTERVAL = 3000;
  const LOCAL_STATE_KEY = 'ngh_er_patient_states_v1';

  // State tracking: { [mrn]: { stage: 1 | 2, complaint: string, ts: number } }
  // stage 1 = basic info sent (complaint was empty)
  // stage 2 = full info sent (with complaint)
  let patientStates = {};
  try {
    const saved = localStorage.getItem(LOCAL_STATE_KEY);
    if (saved) patientStates = JSON.parse(saved);
  } catch (e) {
    patientStates = {};
  }

  function saveStates() {
    try {
      const now = Date.now();
      const cutoff = 24 * 60 * 60 * 1000;
      for (const k in patientStates) {
        if (now - (patientStates[k].ts || 0) > cutoff) {
          delete patientStates[k];
        }
      }
      localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(patientStates));
    } catch (e) {}
  }

  // Captured session credentials and list query payload
  const capturedHeaders = {};
  const skipHeaders = ['content-type', 'content-length', 'accept'];
  let capturedListRequest = null;
  let isProcessingQueue = false;
  let lastNtfySyncTime = 0;

  // Tiny unobtrusive status badge in bottom-left corner
  const badge = document.createElement('div');
  badge.id = 'ngh-er-monitor-badge';
  Object.assign(badge.style, {
    position: 'fixed',
    bottom: '8px',
    left: '8px',
    backgroundColor: 'rgba(22, 27, 34, 0.85)',
    color: '#8b949e',
    border: '1px solid #30363d',
    borderRadius: '12px',
    padding: '3px 9px',
    fontSize: '10px',
    fontFamily: 'system-ui, sans-serif',
    zIndex: '99999',
    pointerEvents: 'none',
    transition: 'color 0.2s'
  });
  badge.textContent = 'ER Monitor: Standby';
  if (document.body) {
    document.body.appendChild(badge);
  } else {
    window.addEventListener('DOMContentLoaded', () => document.body.appendChild(badge));
  }

  function updateBadge(text, color) {
    if (!badge) return;
    badge.textContent = text;
    if (color) badge.style.color = color;
  }

  // Extract phone number from patient API text
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

  // Fetch mobile number using MRN or internal patientID
  async function fetchPatientMobile(mrn, patientId) {
    const candidates = [mrn, patientId].filter(v => v && v !== 'N/A');
    const uniqueCandidates = [...new Set(candidates)];

    for (const idVal of uniqueCandidates) {
      try {
        const headers = Object.assign({ 'Accept': 'application/json' }, capturedHeaders);
        const url = `/csi-api/csi-net-empiread/api/patient/${idVal}?lang=en&internationalization=true`;
        const res = await window.fetch(url, { method: 'GET', headers, credentials: 'include' });
        if (!res.ok) continue;
        const text = await res.text();
        const phone = extractPhoneFromJson(text);
        if (phone && phone !== 'N/A') return phone;
      } catch (e) {}
    }
    return 'N/A';
  }

  // Sync recent sent messages from ntfy.sh to prevent duplicates across multiple PCs
  function syncRemoteNtfyHistory() {
    return new Promise((resolve) => {
      const now = Date.now();
      if (now - lastNtfySyncTime < 8000) {
        resolve();
        return;
      }
      lastNtfySyncTime = now;

      GM_xmlhttpRequest({
        method: 'GET',
        url: `https://ntfy.sh/${NTFY_TOPIC}/json?poll=1&since=12h`,
        onload: function(res) {
          try {
            const lines = (res.responseText || '').split('\n').filter(Boolean);
            for (const line of lines) {
              const evt = JSON.parse(line);
              if (evt.event !== 'message' || !evt.message) continue;

              const mrnMatch = evt.message.match(/MRN:\s*([^\n\r]+)/i);
              const compMatch = evt.message.match(/Complaint:\s*([^\n\r]+)/i);
              if (!mrnMatch) continue;

              const mrn = mrnMatch[1].trim();
              const comp = compMatch ? compMatch[1].trim() : '';
              const hasRealComplaint = comp && comp !== 'Pending' && comp !== 'N/A' && comp !== '-';
              const remoteStage = hasRealComplaint ? 2 : 1;

              const currentLocal = patientStates[mrn];
              if (!currentLocal || remoteStage > currentLocal.stage) {
                patientStates[mrn] = {
                  stage: remoteStage,
                  complaint: hasRealComplaint ? comp : '',
                  ts: (evt.time ? evt.time * 1000 : now)
                };
              }
            }
            saveStates();
          } catch (e) {}
          resolve();
        },
        onerror: function() {
          resolve();
        }
      });
    });
  }

  // Push notification to ntfy.sh
  function pushToNtfy(patient, hasComplaint) {
    return new Promise((resolve) => {
      const complaintLabel = hasComplaint ? patient.complaint : 'Pending';
      const title = hasComplaint
        ? `ER Diagnosis: ${patient.complaint}`
        : `New ER Patient: ${patient.name}`;

      const message = [
        `Name: ${patient.name}`,
        `ID: ${patient.id}`,
        `MRN: ${patient.mrn}`,
        `Age: ${patient.age}`,
        `Mobile: ${patient.mobile}`,
        `Complaint: ${complaintLabel}`
      ].join('\n');

      GM_xmlhttpRequest({
        method: 'POST',
        url: `https://ntfy.sh/${NTFY_TOPIC}`,
        headers: {
          'Title': title,
          'Priority': 'high',
          'Tags': hasComplaint ? 'stethoscope,hospital' : 'hospital'
        },
        data: message,
        onload: function() {
          resolve(true);
        },
        onerror: function() {
          resolve(false);
        }
      });
    });
  }

  // Normalize complaint value
  function cleanComplaint(raw) {
    if (!raw) return '';
    const str = String(raw).replace(/\s+/g, ' ').trim();
    if (!str || str === '-' || str === 'N/A' || str.toLowerCase() === 'null') return '';
    return str;
  }

  // Process a batch of extracted patient objects
  async function processPatientsBatch(patients) {
    if (!Array.isArray(patients) || patients.length === 0) return;
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    try {
      await syncRemoteNtfyHistory();

      for (const p of patients) {
        const mrn = String(p.mrn || '').trim();
        if (!mrn || mrn === 'N/A') continue;

        const complaint = cleanComplaint(p.complaint);
        const hasComplaint = Boolean(complaint);
        const existing = patientStates[mrn];

        // Skip if already sent with full diagnosis
        if (existing && existing.stage >= 2) continue;

        // Skip if already sent without diagnosis and diagnosis is still empty
        if (existing && existing.stage === 1 && !hasComplaint) continue;

        // Fetch mobile number before sending
        const mobile = await fetchPatientMobile(mrn, p.patientId);
        const targetStage = hasComplaint ? 2 : 1;

        // Re-check right before send in case another async pass updated it
        if (patientStates[mrn] && patientStates[mrn].stage >= targetStage) continue;

        const sent = await pushToNtfy({
          name: p.name || 'Unknown',
          id: p.id || 'N/A',
          mrn: mrn,
          age: p.age || 'N/A',
          mobile: mobile,
          complaint: complaint
        }, hasComplaint);

        if (sent) {
          patientStates[mrn] = {
            stage: targetStage,
            complaint: complaint,
            ts: Date.now()
          };
          saveStates();
          updateBadge(`Sent: ${mrn} (Stage ${targetStage})`, '#3fb950');
        }
      }
    } finally {
      isProcessingQueue = false;
    }
  }

  // Extract patient list from GetAdvancedGridData JSON response
  function extractPatientsFromApiPayload(data) {
    if (!data) return [];
    let rows = [];

    if (Array.isArray(data)) {
      rows = data;
    } else if (typeof data === 'object') {
      const candidateKeys = ['rows', 'data', 'items', 'result', 'records', 'gridData', 'list'];
      for (const k of candidateKeys) {
        if (Array.isArray(data[k])) {
          rows = data[k];
          break;
        }
      }
      if (rows.length === 0) {
        for (const k of Object.keys(data)) {
          if (Array.isArray(data[k]) && data[k].length > 0 && typeof data[k][0] === 'object') {
            rows = data[k];
            break;
          }
        }
      }
    }

    return rows.map((row) => {
      if (!row || typeof row !== 'object') return null;
      const name = row.patientName || row.PatientName || row.fullName || '';
      const mrn = row.localMRN || row.LocalMRN || row.mrn || row.MRN || '';
      const id = row.idNumber || row.IdNumber || row.nationalId || 'N/A';
      const age = row.age || row.Age || 'N/A';
      const complaint = row.chiefComplaint || row.ChiefComplaint || row.diagnosis || '';
      const patientId = row.patientID || row.patientId || row.PatientID || '';

      if (!name && !mrn) return null;
      return {
        name: String(name).trim(),
        mrn: String(mrn).trim(),
        id: String(id).trim(),
        age: String(age).trim(),
        complaint: cleanComplaint(complaint),
        patientId: String(patientId).trim()
      };
    }).filter(Boolean);
  }

  // Hook XMLHttpRequest to capture auth headers, grid request, and live responses
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
      if (this._nghMeta.url.includes('/csi-api/') && !skipHeaders.includes(header.toLowerCase())) {
        capturedHeaders[header] = value;
      }
    }
    return origSetHeader.apply(this, arguments);
  };

  window.XMLHttpRequest.prototype.send = function(body) {
    if (this._nghMeta && this._nghMeta.url.includes('/csi-api/')) {
      const meta = this._nghMeta;

      if (meta.url.includes('GetAdvancedGridData') && meta.method === 'POST') {
        capturedListRequest = {
          url: meta.url,
          headers: Object.assign({}, meta.headers),
          body: body ? String(body) : ''
        };
        updateBadge('ER Monitor: API Linked', '#58a6ff');
      }

      this.addEventListener('load', () => {
        if (!meta.url.includes('GetAdvancedGridData')) return;
        try {
          let parsed = null;
          if (this.responseType === 'json' && this.response) {
            parsed = this.response;
          } else if (this.responseText) {
            parsed = JSON.parse(this.responseText);
          }
          const patients = extractPatientsFromApiPayload(parsed);
          if (patients.length > 0) {
            processPatientsBatch(patients);
          }
        } catch (e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  // Background API replay (works even when doctor navigates inside a patient chart)
  async function pollGridApiInBackground() {
    if (!capturedListRequest) return;
    try {
      let payloadObj = JSON.parse(capturedListRequest.body);
      payloadObj.startRow = 0;
      payloadObj.endRow = 50;
      if (payloadObj.searchParams) {
        payloadObj.searchParams.startRow = 0;
        payloadObj.searchParams.endRow = 50;
      }
      if (payloadObj.metaParams) {
        payloadObj.metaParams.uiDate = new Date().toISOString();
      }

      const headers = Object.assign(
        { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        capturedListRequest.headers,
        capturedHeaders
      );

      const res = await window.fetch(capturedListRequest.url, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(payloadObj)
      });

      if (!res.ok) return;
      const parsed = await res.json();
      const patients = extractPatientsFromApiPayload(parsed);
      if (patients.length > 0) {
        updateBadge(`ER Monitor: Live (${patients.length})`, '#58a6ff');
        await processPatientsBatch(patients);
      }
    } catch (e) {}
  }

  // Fallback DOM reader for visible AG Grid rows
  function scanVisibleGridDom() {
    if (window.location.href.includes('/patient/')) return;
    const rowNodes = document.querySelectorAll('[role="row"][row-index]');
    if (!rowNodes.length) return;

    const rowMap = new Map();
    rowNodes.forEach((row) => {
      const idx = row.getAttribute('row-index');
      if (!idx) return;
      if (!rowMap.has(idx)) rowMap.set(idx, []);
      rowMap.get(idx).push(row);
    });

    const patients = [];
    rowMap.forEach((parts) => {
      const queryPart = (sel) => {
        for (const p of parts) {
          const el = p.querySelector(sel);
          if (el) return el;
        }
        return null;
      };

      const nameEl = queryPart('[col-id="patientName"], span.patient_name');
      const mrnEl = queryPart('[col-id="localMRN"], span.patient_mrn');
      if (!nameEl || !mrnEl) return;

      const idEl = queryPart('[col-id="idNumber"], span.patient_idnumber');
      const ageEl = queryPart('[col-id="age"], div.patient_age');
      const compEl = queryPart('[col-id="chiefComplaint"]');

      let idVal = 'N/A';
      if (idEl) {
        const m = idEl.innerText.match(/\d+/);
        if (m) idVal = m[0];
      }

      patients.push({
        name: nameEl.innerText.trim(),
        mrn: mrnEl.innerText.trim(),
        id: idVal,
        age: ageEl ? ageEl.innerText.trim() : 'N/A',
        complaint: compEl ? cleanComplaint(compEl.innerText) : '',
        patientId: ''
      });
    });

    if (patients.length > 0) {
      processPatientsBatch(patients);
    }
  }

  // Safely click "Reset Filter(s)" if present and doctor is not typing
  function autoClickResetFilter() {
    try {
      if (window.location.href.includes('/patient/')) return;

      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
      }

      const buttons = document.querySelectorAll('button.clear-filter');
      for (const btn of buttons) {
        if (btn && btn.offsetParent !== null && !btn.disabled) {
          btn.click();
          break;
        }
      }
    } catch (e) {}
  }

  setInterval(pollGridApiInBackground, API_POLL_INTERVAL);
  setInterval(scanVisibleGridDom, DOM_SCAN_INTERVAL);
  setInterval(autoClickResetFilter, RESET_BTN_INTERVAL);
})();
