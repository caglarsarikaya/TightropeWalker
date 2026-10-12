/**
 * RouteStrip.js
 * Top HUD bar: run timer and a route line from the start summit to the far
 * summit with the walker's position and meters remaining.
 */

/**
 * Format seconds as m:ss.t
 */
function formatTime(seconds) {
    const total = Math.max(0, seconds);
    const minutes = Math.floor(total / 60);
    const rest = total - minutes * 60;
    return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

class RouteStrip {
    /**
     * @param {HTMLElement} timerElement - Element showing the time
     * @param {HTMLElement} routeElement - Container for the route line
     */
    constructor(timerElement, routeElement) {
        this.timer = timerElement;
        this.route = routeElement;
        routeElement.innerHTML = `
            <svg class="route-peak" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20 L10 6 L14 12 L16 9 L22 20 Z"/></svg>
            <div class="route-track">
                <div class="route-fill" data-ref="fill"></div>
                <div class="route-dot" data-ref="dot"></div>
            </div>
            <svg class="route-peak is-goal" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 20 L10 6 L14 12 L16 9 L22 20 Z"/><path class="flag" d="M10 6 V1 L14 2.5 L10 4"/></svg>
            <span class="route-meters" data-ref="meters"></span>
        `;
        this.fill = routeElement.querySelector('[data-ref="fill"]');
        this.dot = routeElement.querySelector('[data-ref="dot"]');
        this.meters = routeElement.querySelector('[data-ref="meters"]');
        this.last = {};
    }

    /**
     * @param {object} state - { time, progress: 0..1, ropeLength }
     */
    update({ time, progress, ropeLength }) {
        const timeText = formatTime(time);
        if (timeText !== this.last.timeText) {
            this.last.timeText = timeText;
            this.timer.textContent = timeText;
        }

        const p = Math.round(progress * 1000) / 1000;
        if (p !== this.last.progress) {
            this.last.progress = p;
            this.fill.style.transform = `scaleX(${p})`;
            this.dot.style.left = `${(p * 100).toFixed(1)}%`;
        }

        const left = Math.max(0, Math.ceil(ropeLength * (1 - progress)));
        if (left !== this.last.left) {
            this.last.left = left;
            this.meters.textContent = left === 0 ? 'Summit!' : `${left} m to go`;
        }
    }
}

export { RouteStrip, formatTime };
