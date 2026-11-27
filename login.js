// @name Quick Auto Login (Alt+A)
// @match https://apphiss1vi.moh.gov.sa/*

(function () {
    'use strict';

    const CREDENTIALS = {
        username: 'abfaalobaidi',
        password: 'Ma9101419#'
    };

    function setNativeValue(element, value) {
        if (!element) return;
        element.focus();
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (descriptor && descriptor.set) {
            descriptor.set.call(element, value);
        } else {
            element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findLoginFields() {
        const passInput = document.querySelector(
            'input[type="password"]:not([disabled]), input[name="password"]:not([disabled]), input#password:not([disabled])'
        );

        let userInput = document.querySelector(
            'input[name="username"]:not([disabled]), input#username:not([disabled]), input[autocomplete="username"]:not([disabled]), input[placeholder*="Username" i]:not([disabled]), input[placeholder*="email" i]:not([disabled])'
        );

        if (!userInput && passInput) {
            const scope = passInput.closest('form') || document;
            const candidates = Array.from(
                scope.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')
            ).filter((el) => el.offsetParent !== null && !el.disabled && !el.readOnly);
            userInput = candidates[0] || null;
        }

        return { userInput, passInput };
    }

    function submitLogin(passInput) {
        const form = passInput.closest('form');
        const enterOpts = {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        };

        passInput.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
        passInput.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
        passInput.dispatchEvent(new KeyboardEvent('keyup', enterOpts));

        const scope = form || document;
        const submitBtn =
            scope.querySelector('button[type="submit"], input[type="submit"], #kc-login') ||
            Array.from(scope.querySelectorAll('button')).find((btn) =>
                /log\s*in|sign\s*in/i.test(btn.textContent || '')
            );

        if (submitBtn) {
            submitBtn.click();
        } else if (form) {
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
            } else {
                form.submit();
            }
        }
    }

    function triggerAutoLogin() {
        const { userInput, passInput } = findLoginFields();
        if (!userInput || !passInput) return false;

        setNativeValue(userInput, CREDENTIALS.username);
        setNativeValue(passInput, CREDENTIALS.password);
        submitLogin(passInput);
        return true;
    }

    window.addEventListener(
        'keydown',
        function (event) {
            if (event.altKey && !event.ctrlKey && !event.metaKey && (event.code === 'KeyA' || event.key.toLowerCase() === 'a')) {
                const executed = triggerAutoLogin();
                if (executed) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        },
        true
    );
})();
