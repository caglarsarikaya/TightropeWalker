/**
 * InputController.js
 * Tracks which keys are held so game logic can poll input every frame
 * instead of juggling keydown/keyup flags.
 */

const ACTION_KEYS = {
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    rotateLeft: ['KeyQ'],
    rotateRight: ['KeyE']
};

const GAME_KEYS = new Set(Object.values(ACTION_KEYS).flat());

class InputController {
    constructor() {
        this.held = new Set();
        this.virtual = {};
        this.pressListeners = [];

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onBlur = this.onBlur.bind(this);

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
    }

    onKeyDown(event) {
        // Sliders and other form controls keep their own arrow-key behaviour
        const target = event.target;
        const inFormControl = target instanceof HTMLInputElement || target instanceof HTMLSelectElement;
        if (inFormControl && event.code !== 'Escape') {
            return;
        }

        if (GAME_KEYS.has(event.code)) {
            // Stop arrow keys from scrolling the page
            event.preventDefault();
        }

        if (!event.repeat) {
            for (const listener of this.pressListeners) {
                listener(event.code, event);
            }
        }

        this.held.add(event.code);
    }

    onKeyUp(event) {
        this.held.delete(event.code);
    }

    onBlur() {
        // Keys released while the window is unfocused never fire keyup
        this.held.clear();
        this.virtual = {};
    }

    /**
     * Register a callback for single key presses (no auto-repeat)
     * @param {Function} listener - Called with the KeyboardEvent.code
     */
    onPress(listener) {
        this.pressListeners.push(listener);
    }

    /**
     * @param {string} action - One of the ACTION_KEYS names
     * @returns {boolean} Whether any key bound to the action is held
     */
    isDown(action) {
        return this.virtual[action] === true || ACTION_KEYS[action].some(code => this.held.has(code));
    }

    /**
     * Hold or release an action from on-screen (touch) controls
     * @param {string} action - One of the ACTION_KEYS names
     * @param {boolean} held
     */
    setVirtual(action, held) {
        this.virtual[action] = held;
    }

    clearVirtual() {
        this.virtual = {};
    }

    /**
     * Snapshot of all action states for this frame
     */
    getState() {
        return {
            forward: this.isDown('forward'),
            back: this.isDown('back'),
            left: this.isDown('left'),
            right: this.isDown('right'),
            rotateLeft: this.isDown('rotateLeft'),
            rotateRight: this.isDown('rotateRight')
        };
    }
}

export { InputController };
