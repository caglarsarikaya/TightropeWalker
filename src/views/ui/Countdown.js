/**
 * Countdown.js
 * Big "3 · 2 · 1 · GO" before the player gets control.
 */

class Countdown {
    /**
     * @param {HTMLElement} root - Element (#countdown)
     */
    constructor(root) {
        this.root = root;
        this.value = null;
        this.hideTimer = null;
    }

    /**
     * @param {string|null} value - '3', '2', '1', 'GO' or null to hide
     */
    show(value) {
        if (value === this.value) return;
        this.value = value;
        clearTimeout(this.hideTimer);

        if (value === null) {
            this.root.classList.remove('is-visible');
            return;
        }

        this.root.textContent = value;
        this.root.classList.toggle('is-go', value === 'GO');
        // Restart the pop animation
        this.root.classList.remove('is-visible');
        void this.root.offsetWidth;
        this.root.classList.add('is-visible');

        if (value === 'GO') {
            this.hideTimer = setTimeout(() => this.show(null), 700);
        }
    }
}

export { Countdown };
