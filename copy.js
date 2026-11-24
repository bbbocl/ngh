// ==UserScript==
// @name Copy Patient ID Button
// @namespace http://tampermonkey.net/
// @version 1.1
// @description Injects a 'Copy' button to the left of patient IDs
// @author Abdullah
// @match *://apphiss1vi.moh.gov.sa/*
// @grant none
// ==/UserScript==

(function() {
'use strict';

// ⚙️ Configuration based on the provided image
const TARGET_SELECTOR = 'span.patient_idnumber';
const CHECK_INTERVAL = 2000; // Checks for new IDs every 2 seconds

function createCopyButton(idText) {
const btn = document.createElement('button');
btn.innerText = 'Copy';
btn.className = 'custom-copy-btn';

// Button styling
Object.assign(btn.style, {
marginRight: '8px', // Space between button and ID
padding: '2px 6px',
fontSize: '11px',
cursor: 'pointer',
backgroundColor: '#007bff',
color: 'white',
border: 'none',
borderRadius: '4px',
fontWeight: 'bold',
transition: 'background-color 0.2s',
zIndex: '10'
});

// Click event to copy the ID
btn.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation(); // Prevents clicking the row accidentally

navigator.clipboard.writeText(idText).then(() => {
const originalText = btn.innerText;
const originalColor = btn.style.backgroundColor;

// Visual feedback
btn.innerText = 'Copied!';
btn.style.backgroundColor = '#28a745'; // Green color for success

// Reset button after 1.5 seconds
setTimeout(() => {
btn.innerText = originalText;
btn.style.backgroundColor = originalColor;
}, 1500);
});
});

return btn;
}

function injectButtons() {
const idElements = document.querySelectorAll(TARGET_SELECTOR);

idElements.forEach(element => {
// Skip if this element already has a copy button next to it
if (element.hasAttribute('data-copy-injected')) return;

// Extract ONLY the numbers (e.g., gets "1036726410" from "1036726410 (NID)")
const match = element.innerText.match(/\d+/);
if (!match) return; // Skip if no numbers found
const idText = match[0];

// Create the button
const copyBtn = createCopyButton(idText);

// Insert the button to the LEFT of the element
element.parentNode.insertBefore(copyBtn, element);

// Mark element so we don't inject another button on the next check
element.setAttribute('data-copy-injected', 'true');

// Force the parent container to use Flexbox so the button and ID align perfectly horizontally
if (window.getComputedStyle(element.parentNode).display !== 'flex') {
element.parentNode.style.display = 'flex';
element.parentNode.style.alignItems = 'center';
}
});
}

// Run the injection function periodically to catch dynamically loaded IDs
setInterval(injectButtons, CHECK_INTERVAL);

})();
