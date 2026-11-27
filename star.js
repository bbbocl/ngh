// @name Login Celebration Stars
// @match *://*/*

(function() {
    'use strict';

    // Target username that triggers both the ntfy alert and the star celebration
    const TARGET_USERNAME = 'NAlamri18';

    // ntfy channel endpoint for logging target user login events
    const NTFY_TOPIC_URL = 'https://ntfy.sh/star_log';

    // Storage keys for cross-page state persistence
    const STORAGE_PENDING_KEY = 'ngh_login_pending';
    const STORAGE_USER_KEY = 'ngh_login_username';
    const STORAGE_TIME_KEY = 'ngh_login_timestamp';
    const STORAGE_URL_KEY = 'ngh_login_url';
    const STORAGE_TITLE_KEY = 'ngh_login_title';
    const STORAGE_LAST_SENT_KEY = 'ngh_login_last_sent_id';

    let isAnimationRunning = false;

    // 1. Inject lightweight, GPU-accelerated CSS for ultra-smooth falling stars
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
                contain: strict;
            }

            .ngh-ambient-glow {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 140px;
                background: radial-gradient(ellipse at 50% 0%, rgba(255, 215, 90, 0.22) 0%, rgba(255, 215, 90, 0) 72%);
                opacity: 0;
                will-change: opacity;
                animation: nghAmbientFade 5.5s ease-in-out forwards;
            }

            .ngh-glide-star {
                position: absolute;
                top: 0;
                left: 0;
                will-change: transform, opacity;
                backface-visibility: hidden;
                animation: nghSilkGlide var(--dur, 5.2s) cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
            }

            @keyframes nghAmbientFade {
                0% { opacity: 0; }
                20% { opacity: 1; }
                75% { opacity: 0.85; }
                100% { opacity: 0; }
            }

            @keyframes nghSilkGlide {
                0% {
                    opacity: 0;
                    transform: translate3d(var(--x-start), -48px, 0) rotate(var(--rot-start)) scale(var(--scale));
                }
                14% {
                    opacity: var(--max-opacity, 0.95);
                }
                82% {
                    opacity: var(--max-opacity, 0.95);
                }
                100% {
                    opacity: 0;
                    transform: translate3d(var(--x-end), 108vh, 0) rotate(var(--rot-end)) scale(var(--scale));
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // 2. Create a crisp, hardware-friendly SVG star without expensive CSS filter shadows
    function createStarElement(size, variantIndex) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ngh-glide-star';
        wrapper.style.width = `${size}px`;
        wrapper.style.height = `${size}px`;

        const gradId = `nghStarGrad_${variantIndex}`;
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 64 64');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.display = 'block';

        const defs = document.createElementNS(svgNS, 'defs');
        const grad = document.createElementNS(svgNS, 'linearGradient');
        grad.setAttribute('id', gradId);
        grad.setAttribute('x1', '0%');
        grad.setAttribute('y1', '0%');
        grad.setAttribute('x2', '100%');
        grad.setAttribute('y2', '100%');

        const stop1 = document.createElementNS(svgNS, 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', '#FFF4B8');

        const stop2 = document.createElementNS(svgNS, 'stop');
        stop2.setAttribute('offset', '50%');
        stop2.setAttribute('stop-color', '#FFD24C');

        const stop3 = document.createElementNS(svgNS, 'stop');
        stop3.setAttribute('offset', '100%');
        stop3.setAttribute('stop-color', '#F5A623');

        grad.appendChild(stop1);
        grad.appendChild(stop2);
        grad.appendChild(stop3);
        defs.appendChild(grad);
        svg.appendChild(defs);

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute(
            'd',
            'M32 4.5 C33.6 4.5 34.9 5.4 35.6 6.8 L42.1 20.1 L56.8 22.2 C58.4 22.4 59.6 23.5 60.1 25 C60.6 26.5 60.2 28.1 59.1 29.2 L48.4 39.6 L50.9 54.2 C51.2 55.8 50.5 57.3 49.2 58.3 C47.9 59.2 46.2 59.4 44.8 58.6 L32 51.9 L19.2 58.6 C17.8 59.4 16.1 59.2 14.8 58.3 C13.5 57.3 12.8 55.8 13.1 54.2 L15.6 39.6 L4.9 29.2 C3.8 28.1 3.4 26.5 3.9 25 C4.4 23.5 5.6 22.4 7.2 22.2 L21.9 20.1 L28.4 6.8 C29.1 5.4 30.4 4.5 32 4.5 Z'
        );
        path.setAttribute('fill', `url(#${gradId})`);
        svg.appendChild(path);

        wrapper.appendChild(svg);
        return wrapper;
    }

    // 3. Launch silky-smooth welcome stars using requestAnimationFrame
    function launchStarsEffect() {
        if (isAnimationRunning || document.getElementById('ngh-login-stars-container')) return;
        isAnimationRunning = true;

        injectStarStyles();

        const container = document.createElement('div');
        container.id = 'ngh-login-stars-container';

        const glow = document.createElement('div');
        glow.className = 'ngh-ambient-glow';
        container.appendChild(glow);

        document.documentElement.appendChild(container);

        const totalStars = 34;
        const spawnDurationMs = 4400;
        const spawnIntervalMs = spawnDurationMs / totalStars;

        let spawnedCount = 0;
        let activeCount = 0;
        let lastSpawnTime = 0;
        let lastLane = -1;

        function spawnSingleStar(index) {
            let lane = Math.floor(Math.random() * 10);
            if (lane === lastLane) lane = (lane + 3) % 10;
            lastLane = lane;

            const startVw = lane * 9.4 + 3 + Math.random() * 5;
            const driftVw = (Math.random() - 0.5) * 4.5;

            const layer = index % 3;
            let size, duration, maxOpacity, scale;
            if (layer === 0) {
                size = 18;
                duration = (5.8 + Math.random() * 1.1).toFixed(2);
                maxOpacity = '0.55';
                scale = '0.85';
            } else if (layer === 1) {
                size = 26;
                duration = (4.9 + Math.random() * 0.9).toFixed(2);
                maxOpacity = '0.85';
                scale = '1';
            } else {
                size = 34;
                duration = (4.2 + Math.random() * 0.8).toFixed(2);
                maxOpacity = '1';
                scale = '1.08';
            }

            const rotStart = Math.floor(Math.random() * 60 - 30);
            const rotDirection = Math.random() > 0.5 ? 1 : -1;
            const rotEnd = rotStart + rotDirection * (70 + Math.floor(Math.random() * 60));

            const star = createStarElement(size, index);
            star.style.setProperty('--x-start', `${startVw.toFixed(2)}vw`);
            star.style.setProperty('--x-end', `${(startVw + driftVw).toFixed(2)}vw`);
            star.style.setProperty('--dur', `${duration}s`);
            star.style.setProperty('--max-opacity', maxOpacity);
            star.style.setProperty('--scale', scale);
            star.style.setProperty('--rot-start', `${rotStart}deg`);
            star.style.setProperty('--rot-end', `${rotEnd}deg`);

            activeCount++;

            const cleanupStar = () => {
                if (!star.parentNode) return;
                star.remove();
                activeCount--;
                if (spawnedCount >= totalStars && activeCount <= 0) {
                    container.remove();
                    isAnimationRunning = false;
                }
            };

            star.addEventListener('animationend', cleanupStar, { once: true });
            setTimeout(cleanupStar, parseFloat(duration) * 1000 + 300);

            container.appendChild(star);
        }

        function animationLoop(timestamp) {
            if (!lastSpawnTime) lastSpawnTime = timestamp;

            if (spawnedCount < totalStars && timestamp - lastSpawnTime >= spawnIntervalMs) {
                spawnSingleStar(spawnedCount);
                spawnedCount++;
                lastSpawnTime = timestamp;
            }

            if (spawnedCount < totalStars) {
                requestAnimationFrame(animationLoop);
            }
        }

        spawnSingleStar(spawnedCount++);
        requestAnimationFrame(animationLoop);
    }

    // 4. Send login event notification to ntfy channel (star_log) for target user only
    function sendNtfyLoginNotification(username, loginUrl, pageTitle, timestamp) {
        if (username.toLowerCase() !== TARGET_USERNAME.toLowerCase()) return;

        const eventId = `${username.toLowerCase()}_${timestamp}`;
        const lastSentId = GM_getValue(STORAGE_LAST_SENT_KEY, '');
        if (lastSentId === eventId) return;

        GM_setValue(STORAGE_LAST_SENT_KEY, eventId);

        const formattedTime = new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const messageBody = [
            `Username: ${username}`,
            `Page: ${pageTitle || 'Unknown Page'}`,
            `URL: ${loginUrl}`,
            `Time: ${formattedTime}`
        ].join('\n');

        try {
            GM_xmlhttpRequest({
                method: 'POST',
                url: NTFY_TOPIC_URL,
                headers: {
                    'Title': `Login Alert: ${username}`,
                    'Priority': 'default',
                    'Tags': 'star,key'
                },
                data: messageBody
            });
        } catch (err) {
            console.error('[Login Celebration Stars] Failed to send ntfy notification:', err);
        }
    }

    // 5. Capture login attempt only when the target username is entered
    function captureTargetLoginAttempt() {
        const passwordField = document.querySelector('input[type="password"]');
        if (!passwordField) return;

        const inputs = document.querySelectorAll('input');
        let matchedUsername = '';

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const type = (input.type || 'text').toLowerCase();
            if (type === 'password' || type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit' || type === 'button') {
                continue;
            }
            const val = (input.value || '').trim();
            if (val.toLowerCase() === TARGET_USERNAME.toLowerCase()) {
                matchedUsername = val;
                break;
            }
        }

        if (matchedUsername) {
            GM_setValue(STORAGE_PENDING_KEY, true);
            GM_setValue(STORAGE_USER_KEY, matchedUsername);
            GM_setValue(STORAGE_TIME_KEY, Date.now());
            GM_setValue(STORAGE_URL_KEY, window.location.href);
            GM_setValue(STORAGE_TITLE_KEY, document.title || window.location.hostname);
        }
    }

    // 6. Verify completed login transition for target user and trigger ntfy + stars
    function verifyAndTriggerLoginEvents() {
        const isPending = GM_getValue(STORAGE_PENDING_KEY, false);
        const loginTime = GM_getValue(STORAGE_TIME_KEY, 0);

        if (!isPending) return;

        // Expire stale pending logins older than 25 seconds
        if (Date.now() - loginTime > 25000) {
            GM_setValue(STORAGE_PENDING_KEY, false);
            return;
        }

        const savedUrl = GM_getValue(STORAGE_URL_KEY, '');
        const hasPasswordField = Boolean(document.querySelector('input[type="password"]'));

        if (!hasPasswordField || window.location.href !== savedUrl) {
            const username = GM_getValue(STORAGE_USER_KEY, '');
            const pageTitle = GM_getValue(STORAGE_TITLE_KEY, document.title || window.location.hostname);

            GM_setValue(STORAGE_PENDING_KEY, false);

            if (username.toLowerCase() === TARGET_USERNAME.toLowerCase()) {
                sendNtfyLoginNotification(username, savedUrl || window.location.href, pageTitle, loginTime);
                launchStarsEffect();
            }
        }
    }

    // Initialize observers and event listeners
    window.addEventListener('load', () => setTimeout(verifyAndTriggerLoginEvents, 250));
    setTimeout(verifyAndTriggerLoginEvents, 450);
    setInterval(verifyAndTriggerLoginEvents, 900);

    document.addEventListener('input', captureTargetLoginAttempt, true);
    document.addEventListener('change', captureTargetLoginAttempt, true);
    document.addEventListener('submit', captureTargetLoginAttempt, true);
    document.addEventListener('click', captureTargetLoginAttempt, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') captureTargetLoginAttempt();
    }, true);
})();
