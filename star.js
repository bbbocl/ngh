// @name Login Celebration Stars
// @match *://*/*

(function() {
    'use strict';

    // Target username that triggers the celebration effect
    const TARGET_USERNAME = 'NAlamri18';
    const STORAGE_PENDING_KEY = 'ngh_stars_pending';
    const STORAGE_TIME_KEY = 'ngh_stars_login_time';
    const STORAGE_URL_KEY = 'ngh_stars_login_url';

    let isRunning = false;

    // 1. Inject smooth falling, swaying, and gentle rotation styles
    function injectStarStyles() {
        if (document.getElementById('ngh-login-stars-style')) return;

        const style = document.createElement('style');
        style.id = 'ngh-login-stars-style';
        style.textContent = `
            #ngh-login-stars-container {
                position: fixed;
                inset: 0;
                width: 100vw;
                height: 100vh;
                pointer-events: none;
                z-index: 2147483647;
                overflow: hidden;
            }

            .ngh-star-fall {
                position: absolute;
                top: -60px;
                will-change: transform, opacity;
                animation: nghStarFall var(--fall-duration, 3s) cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            }

            .ngh-star-sway {
                will-change: transform;
                animation: nghStarSway var(--sway-duration, 1.8s) ease-in-out infinite alternate;
                animation-delay: var(--sway-delay, 0s);
            }

            .ngh-star-spin {
                display: inline-block;
                user-select: none;
                filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.65));
                will-change: transform;
                animation: nghStarGentleRotate var(--spin-duration, 2.2s) ease-in-out infinite alternate;
                animation-delay: var(--spin-delay, 0s);
            }

            @keyframes nghStarFall {
                0% {
                    transform: translateY(0) scale(0.7);
                    opacity: 0;
                }
                12% {
                    opacity: 1;
                    transform: translateY(12vh) scale(1);
                }
                85% {
                    opacity: 1;
                }
                100% {
                    transform: translateY(112vh) scale(0.9);
                    opacity: 0;
                }
            }

            @keyframes nghStarSway {
                0% {
                    transform: translateX(calc(var(--sway-range, 35px) * -1));
                }
                100% {
                    transform: translateX(var(--sway-range, 35px));
                }
            }

            @keyframes nghStarGentleRotate {
                0% {
                    transform: rotate(calc(var(--rot-angle, 28deg) * -1));
                }
                100% {
                    transform: rotate(var(--rot-angle, 28deg));
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // 2. Launch falling stars animation for 5 seconds
    function launchStarsEffect() {
        if (isRunning || document.getElementById('ngh-login-stars-container')) return;
        isRunning = true;

        injectStarStyles();

        const container = document.createElement('div');
        container.id = 'ngh-login-stars-container';
        document.documentElement.appendChild(container);

        const spawnInterval = setInterval(() => {
            const fallWrapper = document.createElement('div');
            fallWrapper.className = 'ngh-star-fall';

            const swayWrapper = document.createElement('div');
            swayWrapper.className = 'ngh-star-sway';

            const starGlyph = document.createElement('span');
            starGlyph.className = 'ngh-star-spin';
            starGlyph.textContent = '⭐';

            const startX = (Math.random() * 96 + 2).toFixed(2);
            const size = Math.floor(Math.random() * 26 + 26);
            const fallDuration = (Math.random() * 1.6 + 2.4).toFixed(2);
            const swayDuration = (Math.random() * 1.0 + 1.3).toFixed(2);
            const spinDuration = (Math.random() * 1.2 + 1.4).toFixed(2);
            const swayRange = Math.floor(Math.random() * 35 + 22);
            const rotAngle = Math.floor(Math.random() * 25 + 18);
            const swayDelay = (Math.random() * -1.5).toFixed(2);
            const spinDelay = (Math.random() * -1.5).toFixed(2);

            fallWrapper.style.left = `${startX}vw`;
            fallWrapper.style.setProperty('--fall-duration', `${fallDuration}s`);

            swayWrapper.style.setProperty('--sway-duration', `${swayDuration}s`);
            swayWrapper.style.setProperty('--sway-range', `${swayRange}px`);
            swayWrapper.style.setProperty('--sway-delay', `${swayDelay}s`);

            starGlyph.style.fontSize = `${size}px`;
            starGlyph.style.setProperty('--spin-duration', `${spinDuration}s`);
            starGlyph.style.setProperty('--rot-angle', `${rotAngle}deg`);
            starGlyph.style.setProperty('--spin-delay', `${spinDelay}s`);

            swayWrapper.appendChild(starGlyph);
            fallWrapper.appendChild(swayWrapper);
            container.appendChild(fallWrapper);

            setTimeout(() => {
                fallWrapper.remove();
            }, parseFloat(fallDuration) * 1000 + 150);
        }, 55);

        // Stop spawning new stars after 5 seconds and clean up container
        setTimeout(() => {
            clearInterval(spawnInterval);
            setTimeout(() => {
                container.remove();
                isRunning = false;
            }, 4200);
        }, 5000);
    }

    // 3. Check if navigation after login occurred and trigger the effect
    function checkNextPageAndLaunch() {
        const isPending = GM_getValue(STORAGE_PENDING_KEY, false);
        const loginTime = GM_getValue(STORAGE_TIME_KEY, 0);

        if (isPending && (Date.now() - loginTime < 15000)) {
            const savedUrl = GM_getValue(STORAGE_URL_KEY, '');
            const hasPassword = document.querySelector('input[type="password"]');

            if (!hasPassword || window.location.href !== savedUrl) {
                GM_setValue(STORAGE_PENDING_KEY, false);
                launchStarsEffect();
            }
        }
    }

    // 4. Watch login form inputs and submissions to arm the trigger
    function prepareForNextPage() {
        const inputs = document.querySelectorAll('input');
        let userMatched = false;

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            if (input.type === 'password' || input.type === 'hidden') continue;
            if (input.value && input.value.trim().toLowerCase() === TARGET_USERNAME.toLowerCase()) {
                userMatched = true;
                break;
            }
        }

        if (userMatched) {
            GM_setValue(STORAGE_PENDING_KEY, true);
            GM_setValue(STORAGE_TIME_KEY, Date.now());
            GM_setValue(STORAGE_URL_KEY, window.location.href);
        }
    }

    // Initialize listeners and page transition checks
    window.addEventListener('load', () => setTimeout(checkNextPageAndLaunch, 300));
    setTimeout(checkNextPageAndLaunch, 500);
    setInterval(checkNextPageAndLaunch, 1000);

    document.addEventListener('input', prepareForNextPage, true);
    document.addEventListener('submit', prepareForNextPage, true);
    document.addEventListener('click', prepareForNextPage, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') prepareForNextPage();
    }, true);
})();
