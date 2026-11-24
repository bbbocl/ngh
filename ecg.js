// ==UserScript==
// @name Send ECG Patient to Phone
// @namespace http://tampermonkey.net/
// @version 4.0
// @description Injects a clickable ECG send button in the ER patient list to push patient details to ntfy
// @author Abdullah
// @match *://apphiss1vi.moh.gov.sa/*
// @grant GM_xmlhttpRequest
// @grant unsafeWindow
// @connect ntfy.sh
// @run-at document-start
// ==/UserScript==

(function() {
'use strict';

const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

// Configuration
const NTFY_TOPIC = 'ecg_ngh';
const CHECK_INTERVAL = 2000;

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

// Send formatted patient details to ntfy
function sendToPhone(data, btn) {
const message = [
`Name: ${data.name}`,
`ID: ${data.id}`,
`MRN: ${data.mrn}`,
`Age: ${data.age}`,
`Mobile: ${data.mobile}`
].join('\n');

GM_xmlhttpRequest({
method: 'POST',
url: `https://ntfy.sh/${NTFY_TOPIC}`,
headers: {
'Title': 'New ECG Order',
'Priority': 'high',
'Tags': 'heartpulse'
},
data: message,
onload: function() {
btn.innerText = '✓ Sent';
btn.style.backgroundColor = '#28a745';
btn.style.borderColor = '#1e7e34';
setTimeout(() => {
btn.innerText = '📤 ECG';
btn.style.backgroundColor = '#dc3545';
btn.style.borderColor = '#b02a37';
btn.disabled = false;
}, 1500);
},
onerror: function() {
btn.innerText = '✕ Error';
setTimeout(() => {
btn.innerText = '📤 ECG';
btn.disabled = false;
}, 1500);
}
});
}

// Create styled clickable button
function createEcgButton(nameElement) {
const btn = document.createElement('button');
btn.type = 'button';
btn.innerText = '📤 ECG';
btn.title = 'Send patient info to phone';
btn.className = 'custom-ecg-btn';

Object.assign(btn.style, {
marginRight: '8px',
padding: '2px 7px',
fontSize: '11px',
cursor: 'pointer',
backgroundColor: '#dc3545',
color: '#ffffff',
border: '1px solid #b02a37',
borderRadius: '4px',
boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
fontWeight: 'bold',
transition: 'background-color 0.15s, transform 0.1s',
zIndex: '10',
flexShrink: '0',
display: 'inline-flex',
alignItems: 'center',
gap: '3px'
});

btn.addEventListener('mouseenter', () => {
if (!btn.disabled) btn.style.backgroundColor = '#bb2d3b';
});
btn.addEventListener('mouseleave', () => {
if (!btn.disabled) btn.style.backgroundColor = '#dc3545';
});

btn.addEventListener('click', async function(e) {
e.preventDefault();
e.stopPropagation();

btn.innerText = '...';
btn.disabled = true;

const row = nameElement.closest('[role="row"]');
const patientName = nameElement.innerText.trim();

let patientId = 'N/A';
let patientMrn = 'N/A';
let patientAge = 'N/A';

const idEl = queryInFullRow(row, 'span.patient_idnumber');
if (idEl) {
const match = idEl.innerText.match(/\d+/);
if (match) patientId = match[0];
}

const mrnEl = queryInFullRow(row, 'span.patient_mrn');
if (mrnEl) patientMrn = mrnEl.innerText.trim();

const ageEl = queryInFullRow(row, 'div.patient_age');
if (ageEl) patientAge = ageEl.innerText.trim();

const patientMobile = await fetchPatientMobile(patientMrn);

sendToPhone({
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
if (element.hasAttribute('data-ecg-injected')) return;

const ecgBtn = createEcgButton(element);
element.parentNode.insertBefore(ecgBtn, element);
element.setAttribute('data-ecg-injected', 'true');

if (window.getComputedStyle(element.parentNode).display !== 'flex') {
element.parentNode.style.display = 'flex';
element.parentNode.style.alignItems = 'center';
}
});
}

setInterval(injectEcgButtons, CHECK_INTERVAL);

})();
