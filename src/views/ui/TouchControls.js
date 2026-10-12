/**
 * TouchControls.js
 * On-screen buttons for phones and tablets. They feed the same actions as
 * the keyboard through InputController.setVirtual().
 *
 * Left thumb: ◀ ▶ (lean on the rope, step sideways on the platform) and
 * turn buttons on the platform. Right thumb: big WALK button and BACK.
 */

class TouchControls {
    /**
     * @param {HTMLElement} root - Container (#touch-controls)
     * @param {InputController} input
     */
    constructor(root, input) {
        this.root = root;
        this.input = input;
        this.onRope = null;

        root.innerHTML = `
            <div class="touch-cluster left">
                <div class="touch-row turn-row">
                    <button class="touch-btn small" data-action="rotateLeft" aria-label="Turn left">⟲</button>
                    <button class="touch-btn small" data-action="rotateRight" aria-label="Turn right">⟳</button>
                </div>
                <div class="touch-row">
                    <button class="touch-btn" data-action="left" aria-label="Lean left">◀</button>
                    <button class="touch-btn" data-action="right" aria-label="Lean right">▶</button>
                </div>
            </div>
            <div class="touch-cluster right">
                <button class="touch-btn small" data-action="back" aria-label="Walk back">BACK</button>
                <button class="touch-btn walk" data-action="forward" aria-label="Walk">WALK</button>
            </div>
        `;

        for (const button of root.querySelectorAll('[data-action]')) {
            const action = button.dataset.action;
            const press = event => {
                event.preventDefault();
                button.setPointerCapture?.(event.pointerId);
                button.classList.add('is-pressed');
                this.input.setVirtual(action, true);
            };
            const release = () => {
                button.classList.remove('is-pressed');
                this.input.setVirtual(action, false);
            };
            button.addEventListener('pointerdown', press);
            button.addEventListener('pointerup', release);
            button.addEventListener('pointercancel', release);
            button.addEventListener('lostpointercapture', release);
            button.addEventListener('contextmenu', event => event.preventDefault());
        }
    }

    /**
     * @param {boolean} visible
     */
    setVisible(visible) {
        this.root.classList.toggle('is-visible', visible);
        if (!visible) this.input.clearVirtual();
    }

    /**
     * Turn buttons only make sense on the platform
     */
    setOnRope(onRope) {
        if (onRope === this.onRope) return;
        this.onRope = onRope;
        this.root.classList.toggle('on-rope', onRope);
    }
}

export { TouchControls };
