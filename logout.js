// @name Quick Logout Shortcut
// @match https://apphiss1vi.moh.gov.sa/*

(function () {
    'use strict';

    // Prevent duplicate listener registration
    if (window.__nghQuickLogoutInitialized) return;
    window.__nghQuickLogoutInitialized = true;

    function findLogoutLink(dropdownBtn) {
        // 1. Search within the dropdown container if button is found
        if (dropdownBtn && dropdownBtn.parentElement) {
            const scopedLinks = dropdownBtn.parentElement.querySelectorAll('a');
            for (const link of scopedLinks) {
                if (link.textContent.trim().toLowerCase() === 'logout') {
                    return link;
                }
            }
            const nthLink = dropdownBtn.parentElement.querySelector('a:nth-of-type(2)');
            if (nthLink && nthLink.textContent.trim().toLowerCase().includes('logout')) {
                return nthLink;
            }
        }

        // 2. Search globally for any anchor explicitly labeled "Logout"
        const allLinks = document.querySelectorAll('a');
        for (const link of allLinks) {
            if (link.textContent.trim().toLowerCase() === 'logout') {
                return link;
            }
        }

        // 3. Fallback to strict selector check
        const fallbackLink = document.querySelector('a:nth-of-type(2)');
        if (fallbackLink && fallbackLink.textContent.trim().toLowerCase().includes('logout')) {
            return fallbackLink;
        }

        return null;
    }

    function triggerFastClick(el) {
        if (!el) return false;
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        el.click();
        return true;
    }

    function executeQuickLogout() {
        const dropdownBtn = document.querySelector('button.csi-dropdown-button');

        // Attempt 1: Click Logout directly without opening the dropdown
        const directLogout = findLogoutLink(dropdownBtn);
        if (directLogout) {
            console.log('[Quick Logout] Direct logout element found. Clicking immediately.');
            triggerFastClick(directLogout);
            return;
        }

        // Attempt 2: Open dropdown and click Logout the instant it renders
        if (!dropdownBtn) {
            console.warn('[Quick Logout] Neither Logout link nor dropdown button was found.');
            return;
        }

        console.log('[Quick Logout] Opening dropdown and waiting for Logout link...');
        let clicked = false;

        const observer = new MutationObserver(() => {
            if (clicked) return;
            const targetLink = findLogoutLink(dropdownBtn);
            if (targetLink) {
                clicked = true;
                observer.disconnect();
                triggerFastClick(targetLink);
                console.log('[Quick Logout] Logout clicked via observer.');
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });

        // Trigger the dropdown button immediately
        triggerFastClick(dropdownBtn);

        // Micro-polling backup in case DOM mutation fires synchronously before observer
        let attempts = 0;
        const fastPoll = setInterval(() => {
            attempts++;
            if (clicked || attempts > 40) {
                clearInterval(fastPoll);
                observer.disconnect();
                return;
            }
            const targetLink = findLogoutLink(dropdownBtn);
            if (targetLink) {
                clicked = true;
                clearInterval(fastPoll);
                observer.disconnect();
                triggerFastClick(targetLink);
                console.log('[Quick Logout] Logout clicked via fast poll.');
            }
        }, 15);
    }

    document.addEventListener('keydown', function (e) {
        // Trigger on Alt + Q (supports both English 'q' and Arabic layout key)
        if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && (e.code === 'KeyQ' || e.key.toLowerCase() === 'q')) {
            e.preventDefault();
            e.stopPropagation();
            executeQuickLogout();
        }
    }, true);
})();
