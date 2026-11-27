// @name Patient Double-Click Dashboard Launcher
// @match https://apphiss1vi.moh.gov.sa/*

(function () {
    'use strict';

    if (window.__patientDblClickLauncherInitialized) {
        return;
    }
    window.__patientDblClickLauncherInitialized = true;

    const PATIENT_NAME_SELECTOR = 'span.patient_name';
    const LAUNCH_BUTTON_SELECTOR = 'button.btn.csi_patient_cta_btn.w-100';
    const MAX_WAIT_MS = 2500;
    const POLL_INTERVAL_MS = 50;

    function clickLaunchButtonWhenReady() {
        const startTime = Date.now();

        const timer = setInterval(() => {
            const launchBtn = document.querySelector(LAUNCH_BUTTON_SELECTOR);

            if (launchBtn && !launchBtn.disabled && launchBtn.offsetParent !== null) {
                clearInterval(timer);
                launchBtn.click();
                console.log('[Patient DblClick Launcher] Launch Patient Dashboard button clicked.');
                return;
            }

            if (Date.now() - startTime >= MAX_WAIT_MS) {
                clearInterval(timer);
                console.warn('[Patient DblClick Launcher] Launch button did not appear within timeout.');
            }
        }, POLL_INTERVAL_MS);
    }

    document.addEventListener('dblclick', function (event) {
        const patientNameEl = event.target.closest(PATIENT_NAME_SELECTOR);
        if (!patientNameEl) {
            return;
        }

        // Allow a brief delay so the first click completes patient row selection
        setTimeout(clickLaunchButtonWhenReady, 60);
    }, true);
})();
