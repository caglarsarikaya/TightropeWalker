/**
 * Prompts.js
 * Contextual tutorial hints ("Hold W to step onto the rope", ...).
 * Each hint is only shown in its first few runs, then it stays quiet.
 */

const PROMPTS = {
    walk: {
        maxRuns: 2,
        keys: '<kbd class="kbd">W</kbd> Walk to the rope gate',
        touch: 'Hold <b>WALK</b> to head for the rope'
    },
    stepOn: {
        maxRuns: 3,
        keys: 'Keep holding <kbd class="kbd">W</kbd> to step onto the rope',
        touch: 'Keep holding <b>WALK</b> to step onto the rope'
    },
    balance: {
        maxRuns: 3,
        keys: '<kbd class="kbd">A</kbd><kbd class="kbd">D</kbd> Lean against the wind to stay up',
        touch: 'Tap <b>◀ ▶</b> to lean against the wind'
    },
    gust: {
        maxRuns: 6,
        keys: 'Gust incoming — brace!',
        touch: 'Gust incoming — brace!'
    }
};

class Prompts {
    /**
     * @param {HTMLElement} root - Toast element (#prompt)
     * @param {Settings} settings - For per-prompt run counts
     */
    constructor(root, settings) {
        this.root = root;
        this.settings = settings;
        this.touch = false;
        this.current = null;
        this.shownThisRun = new Set();
    }

    /**
     * Call at the start of every run
     */
    newRun() {
        this.shownThisRun.clear();
        this.show(null);
    }

    setTouch(touch) {
        this.touch = touch;
    }

    /**
     * Show the given prompt (or nothing) if it hasn't been used up
     * @param {string|null} id
     */
    show(id) {
        let next = id;
        if (next) {
            const prompt = PROMPTS[next];
            if (!this.shownThisRun.has(next)) {
                if (this.settings.promptCount(next) >= prompt.maxRuns) {
                    next = null;
                } else {
                    this.shownThisRun.add(next);
                    this.settings.countPrompt(next);
                }
            }
        }

        if (next === this.current) return;
        this.current = next;

        if (next) {
            this.root.innerHTML = this.touch ? PROMPTS[next].touch : PROMPTS[next].keys;
            this.root.dataset.kind = next;
            this.root.classList.add('is-visible');
        } else {
            this.root.classList.remove('is-visible');
        }
    }
}

export { Prompts };
