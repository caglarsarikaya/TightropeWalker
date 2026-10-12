/**
 * BalanceGauge.js
 * Arc gauge for the walker's lean: safe zone in the middle, warning and
 * danger zones toward the ends, a needle for the current lean and A/D keycaps
 * that light up while pressed.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const ARC_DEGREES = 62;   // Gauge spans -62..62 degrees
const CX = 130;
const CY = 128;
const RADIUS = 104;

function point(angleDegrees, radius = RADIUS) {
    const a = (angleDegrees * Math.PI) / 180;
    return [CX + radius * Math.sin(a), CY - radius * Math.cos(a)];
}

function arcPath(fromDegrees, toDegrees, radius = RADIUS) {
    const [x1, y1] = point(fromDegrees, radius);
    const [x2, y2] = point(toDegrees, radius);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function svg(tag, attributes) {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
}

class BalanceGauge {
    /**
     * @param {HTMLElement} root - Container element (#balance-gauge)
     */
    constructor(root) {
        this.root = root;
        this.lastBalance = null;
        this.lastLevel = null;

        const view = svg('svg', { viewBox: '0 0 260 140', class: 'gauge-svg', 'aria-hidden': 'true' });

        // Track and zones (danger | warning | safe | warning | danger)
        view.appendChild(svg('path', { d: arcPath(-ARC_DEGREES, ARC_DEGREES), class: 'gauge-track' }));
        const zones = [
            [-ARC_DEGREES, -46, 'danger'],
            [-45, -31, 'warn'],
            [-30, 30, 'safe'],
            [31, 45, 'warn'],
            [46, ARC_DEGREES, 'danger']
        ];
        for (const [from, to, kind] of zones) {
            view.appendChild(svg('path', { d: arcPath(from, to), class: `gauge-zone ${kind}` }));
        }

        // Ticks
        for (let angle = -60; angle <= 60; angle += 15) {
            const [x1, y1] = point(angle, RADIUS - 14);
            const [x2, y2] = point(angle, RADIUS - (angle === 0 ? 24 : 19));
            view.appendChild(svg('line', { x1, y1, x2, y2, class: angle === 0 ? 'gauge-tick center' : 'gauge-tick' }));
        }

        // Needle
        this.needle = svg('g', { class: 'gauge-needle' });
        this.needle.appendChild(svg('line', { x1: CX, y1: CY, x2: CX, y2: CY - RADIUS + 2 }));
        this.needle.appendChild(svg('circle', { cx: CX, cy: CY - RADIUS + 2, r: 6 }));
        this.needle.appendChild(svg('circle', { cx: CX, cy: CY, r: 9, class: 'hub' }));
        view.appendChild(this.needle);

        root.appendChild(view);

        const label = document.createElement('div');
        label.className = 'gauge-label';
        label.innerHTML = '<kbd class="kbd" data-key="left">A</kbd><span>Balance</span><kbd class="kbd" data-key="right">D</kbd>';
        root.appendChild(label);

        this.leftKey = label.querySelector('[data-key="left"]');
        this.rightKey = label.querySelector('[data-key="right"]');
    }

    /**
     * @param {object} state - { balance: -1..1, left: bool, right: bool, active: bool }
     */
    update({ balance, left, right, active }) {
        const rounded = Math.round(balance * 200) / 200;
        if (rounded !== this.lastBalance) {
            this.lastBalance = rounded;
            this.needle.style.transform = `rotate(${(rounded * ARC_DEGREES).toFixed(2)}deg)`;
        }

        const danger = Math.abs(balance);
        const level = danger > 0.73 ? 'danger' : danger > 0.48 ? 'warn' : 'safe';
        if (level !== this.lastLevel) {
            this.lastLevel = level;
            this.root.dataset.level = level;
        }

        this.root.classList.toggle('is-dim', !active);
        this.leftKey.classList.toggle('is-active', left);
        this.rightKey.classList.toggle('is-active', right);
    }

    /**
     * Show touch-friendly labels instead of keycaps
     */
    setTouchLabels(touch) {
        this.leftKey.textContent = touch ? '◀' : 'A';
        this.rightKey.textContent = touch ? '▶' : 'D';
    }
}

export { BalanceGauge };
