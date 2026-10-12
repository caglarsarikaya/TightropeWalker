/**
 * WindWidget.js
 * Shows which way the wind pushes the walker, how hard, and warns about
 * incoming gusts.
 */

class WindWidget {
    /**
     * @param {HTMLElement} root - Container element (#wind-widget)
     */
    constructor(root) {
        this.root = root;
        root.innerHTML = `
            <div class="widget-head">
                <span class="widget-label">Wind</span>
                <span class="wind-value" data-ref="value">Calm</span>
            </div>
            <div class="wind-body">
                <svg class="wind-arrow" data-ref="arrow" viewBox="0 0 64 24" aria-hidden="true">
                    <path d="M4 12 H52 M42 4 L54 12 L42 20" />
                    <path class="wind-trail" d="M10 5 H28 M14 19 H32" />
                </svg>
                <div class="meter"><div class="meter-fill" data-ref="fill"></div></div>
            </div>
            <div class="wind-gust" data-ref="gust">Gust incoming</div>
        `;
        this.value = root.querySelector('[data-ref="value"]');
        this.arrow = root.querySelector('[data-ref="arrow"]');
        this.fill = root.querySelector('[data-ref="fill"]');
        this.gust = root.querySelector('[data-ref="gust"]');
        this.last = {};
    }

    /**
     * @param {object} state
     * @param {number} state.lateral - Wind along the walker's right (+ pushes right)
     * @param {number} state.maxWind - Strongest possible wind for this difficulty
     * @param {number|null} state.gust - Lateral strength of an incoming gust, or null
     */
    update({ lateral, maxWind, gust }) {
        const strength = Math.min(1, Math.abs(lateral) / maxWind);
        const percent = Math.round(strength * 100);
        const direction = lateral >= 0 ? 'right' : 'left';
        const level = strength > 0.6 ? 'danger' : strength > 0.3 ? 'warn' : 'safe';

        if (percent !== this.last.percent) {
            this.last.percent = percent;
            this.value.textContent = percent < 4 ? 'Calm' : `${percent}%`;
            this.fill.style.transform = `scaleX(${Math.max(0.02, strength).toFixed(3)})`;
        }
        if (direction !== this.last.direction) {
            this.last.direction = direction;
            this.arrow.classList.toggle('is-left', direction === 'left');
        }
        if (level !== this.last.level) {
            this.last.level = level;
            this.root.dataset.level = level;
        }

        const gustText = gust === null ? '' : `Gust from the ${gust > 0 ? 'left' : 'right'}`;
        if (gustText !== this.last.gustText) {
            this.last.gustText = gustText;
            this.root.classList.toggle('has-gust', gustText !== '');
            if (gustText) this.gust.textContent = gustText;
        }
    }
}

export { WindWidget };
