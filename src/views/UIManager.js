/**
 * UIManager.js
 * Orchestrates the interface: screens (title, how to play, settings, pause,
 * result), the in-game HUD components, keyboard navigation and touch mode.
 * Markup lives in index.html, styles in src/styles/ui.css.
 */

import * as THREE from 'three';
import { BalanceGauge } from './ui/BalanceGauge.js';
import { WindWidget } from './ui/WindWidget.js';
import { RouteStrip, formatTime } from './ui/RouteStrip.js';
import { Prompts } from './ui/Prompts.js';
import { Countdown } from './ui/Countdown.js';
import { TouchControls } from './ui/TouchControls.js';

const DIFFICULTY_LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

const $ = id => document.getElementById(id);

class UIManager {
    /**
     * @param {Game} game - The running game (state, settings, input, models)
     */
    constructor(game) {
        this.game = game;
        this.settings = game.settings;

        this.root = $('ui');
        this.screens = {
            title: $('title-screen'),
            howto: $('howto-screen'),
            settings: $('settings-screen'),
            pause: $('pause-screen'),
            result: $('result-screen')
        };
        this.hud = $('hud');
        this.vignette = $('danger-vignette');
        this.helpCard = $('help-card');
        this.toast = $('toast');
        this.liveRegion = $('live-region');

        this.modalStack = [];
        this.toastTimer = null;
        this._right = new THREE.Vector3();
        this.last = {};

        // HUD components
        this.balanceGauge = new BalanceGauge($('balance-gauge'));
        this.windWidget = new WindWidget($('wind-widget'));
        this.routeStrip = new RouteStrip($('hud-time'), $('route'));
        this.prompts = new Prompts($('prompt'), this.settings);
        this.countdown = new Countdown($('countdown'));
        this.touchControls = new TouchControls($('touch-controls'), game.input);

        this.setupTouchDetection();
        this.setupButtons();
        this.setupSettingsControls();
        this.setupKeyboard();
        this.renderRecords();

        $('title-rope-length').textContent = Math.round(game.environment.ropeLength);

        game.gameState.addStateChangeListener(this.onGameStateChange.bind(this));
    }

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------

    setupTouchDetection() {
        const query = window.matchMedia('(pointer: coarse)');
        const apply = () => {
            this.isTouch = query.matches;
            document.body.classList.toggle('is-touch', this.isTouch);
            this.prompts.setTouch(this.isTouch);
            this.balanceGauge.setTouchLabels(this.isTouch);
        };
        apply();
        query.addEventListener?.('change', apply);
    }

    setupButtons() {
        const game = this.game;
        const on = (id, handler) => $(id).addEventListener('click', () => {
            game.sound.init();
            game.sound.click();
            handler();
        });

        on('start-button', () => game.startRun());
        on('howto-button', () => this.openModal('howto'));
        on('settings-button', () => this.openModal('settings'));
        on('pause-button', () => game.pause());
        on('help-button', () => this.toggleHelp());
        on('resume-button', () => game.resume());
        on('restart-button', () => game.startRun());
        on('pause-settings-button', () => this.openModal('settings'));
        on('quit-button', () => game.quitToTitle());
        on('retry-button', () => game.startRun());
        on('menu-button', () => game.quitToTitle());

        for (const button of this.root.querySelectorAll('[data-close]')) {
            button.addEventListener('click', () => {
                game.sound.click();
                this.closeModal();
            });
        }

        // Reset needs a second press to confirm
        const reset = $('reset-records-button');
        let armed = false;
        let disarmTimer = null;
        reset.addEventListener('click', () => {
            if (!armed) {
                armed = true;
                reset.textContent = 'Press again to confirm';
                disarmTimer = setTimeout(() => {
                    armed = false;
                    reset.textContent = 'Reset records';
                }, 3000);
                return;
            }
            clearTimeout(disarmTimer);
            armed = false;
            reset.textContent = 'Reset records';
            this.settings.resetRecords();
            this.renderRecords();
            this.showNotification('Records cleared', 2000);
        });
    }

    setupSettingsControls() {
        const settings = this.settings;

        for (const group of this.root.querySelectorAll('.segmented[data-setting]')) {
            const key = group.dataset.setting;
            for (const button of group.querySelectorAll('button')) {
                button.addEventListener('click', () => {
                    this.game.sound.click();
                    settings.set(key, button.dataset.value);
                });
            }
        }

        for (const input of this.root.querySelectorAll('input[data-setting]')) {
            const key = input.dataset.setting;
            if (input.type === 'checkbox') {
                input.addEventListener('change', () => settings.set(key, input.checked));
            } else {
                input.addEventListener('input', () => settings.set(key, parseFloat(input.value)));
            }
        }

        settings.onChange(() => {
            this.renderSettings();
            this.renderRecords();
        });
        this.renderSettings();
    }

    renderSettings() {
        for (const group of this.root.querySelectorAll('.segmented[data-setting]')) {
            const value = this.settings.get(group.dataset.setting);
            for (const button of group.querySelectorAll('button')) {
                button.setAttribute('aria-checked', String(button.dataset.value === value));
            }
        }
        for (const input of this.root.querySelectorAll('input[data-setting]')) {
            const value = this.settings.get(input.dataset.setting);
            if (input.type === 'checkbox') input.checked = value;
            else input.value = value;
        }
    }

    renderRecords() {
        const records = this.settings.records;
        $('record-time').textContent = records.bestTime === null ? '—' : formatTime(records.bestTime);
        $('record-distance').textContent = records.bestDistance > 0 ? `${Math.round(records.bestDistance)} m` : '—';
        $('record-difficulty').textContent = DIFFICULTY_LABELS[this.settings.get('difficulty')];
    }

    setupKeyboard() {
        this.game.input.onPress((code, event) => this.onKey(code, event));
    }

    onKey(code, event) {
        const game = this.game;
        const state = game.gameState.currentState;
        const top = this.modalStack[this.modalStack.length - 1];

        if (code === 'Escape') {
            if (top === 'howto' || top === 'settings') this.closeModal();
            else if (top === 'pause') game.resume();
            else if (top === 'result') game.quitToTitle();
            else if (state === 'GAMEPLAY') game.pause();
            return;
        }

        // Menu navigation with arrows when a menu is showing
        const menuOpen = top || state === 'START_SCREEN';
        if (menuOpen && (code === 'ArrowDown' || code === 'ArrowUp' || code === 'ArrowLeft' || code === 'ArrowRight')) {
            this.navigate(code, event);
            return;
        }

        const onButton = document.activeElement instanceof HTMLButtonElement;
        if (state === 'START_SCREEN' && !top && (code === 'Enter' || code === 'NumpadEnter') && !onButton) {
            game.sound.init();
            game.startRun();
        } else if (state === 'GAMEPLAY' && (code === 'KeyP')) {
            game.pause();
        } else if (state === 'PAUSED' && code === 'KeyP' && top === 'pause') {
            game.resume();
        } else if (state === 'GAMEPLAY' && code === 'KeyH') {
            this.toggleHelp();
        } else if (top === 'result' && code === 'KeyR') {
            game.startRun();
        }
    }

    /**
     * Arrow-key focus movement inside the topmost menu
     */
    navigate(code, event) {
        const top = this.modalStack[this.modalStack.length - 1];
        const container = top ? this.screens[top] : this.screens.title;
        const active = document.activeElement;

        // Left/right inside a segmented control changes its value
        const segmented = active?.closest?.('.segmented');
        if (segmented && (code === 'ArrowLeft' || code === 'ArrowRight')) {
            const buttons = [...segmented.querySelectorAll('button')];
            const index = buttons.indexOf(active);
            const next = buttons[Math.max(0, Math.min(buttons.length - 1, index + (code === 'ArrowRight' ? 1 : -1)))];
            next.focus();
            next.click();
            return;
        }

        const focusables = [...container.querySelectorAll('button, input')].filter(el => {
            if (el.closest('.segmented')) {
                // One stop per segmented control: its selected option
                return el.getAttribute('aria-checked') === 'true';
            }
            return el.offsetParent !== null;
        });
        if (focusables.length === 0) return;

        const index = focusables.indexOf(active);
        const step = code === 'ArrowDown' || code === 'ArrowRight' ? 1 : -1;
        const next = index === -1
            ? focusables[0]
            : focusables[(index + step + focusables.length) % focusables.length];
        next.focus();
        event?.preventDefault();
    }

    // ------------------------------------------------------------------
    // Screens
    // ------------------------------------------------------------------

    onGameStateChange(newState) {
        switch (newState) {
            case 'START_SCREEN':
                this.closeAllModals();
                this.setHudVisible(false);
                this.screens.title.classList.add('is-open');
                this.renderRecords();
                this.focusFirst(this.screens.title);
                break;
            case 'GAMEPLAY':
                this.closeAllModals();
                this.screens.title.classList.remove('is-open');
                this.setHudVisible(true);
                break;
            case 'PAUSED':
                this.helpCard.classList.remove('is-open');
                this.openModal('pause');
                this.announce('Game paused');
                break;
            case 'END_SCREEN':
                this.setHudVisible(false);
                break;
        }
    }

    setHudVisible(visible) {
        this.hud.classList.toggle('is-visible', visible);
        this.touchControls.setVisible(visible && this.isTouch);
        if (!visible) {
            this.helpCard.classList.remove('is-open');
            this.prompts.show(null);
            this.countdown.show(null);
            this.vignette.style.opacity = '0';
            this.root.classList.remove('is-shaking');
        }
    }

    openModal(name) {
        const screen = this.screens[name];
        if (this.modalStack.includes(name)) return;
        this.modalStack.push(name);
        screen.classList.add('is-open');
        this.focusFirst(screen);
    }

    closeModal() {
        const name = this.modalStack.pop();
        if (!name) return;
        this.screens[name].classList.remove('is-open');

        const top = this.modalStack[this.modalStack.length - 1];
        const container = top ? this.screens[top] : (this.game.gameState.currentState === 'START_SCREEN' ? this.screens.title : null);
        if (container) this.focusFirst(container);
    }

    closeAllModals() {
        while (this.modalStack.length) {
            this.screens[this.modalStack.pop()].classList.remove('is-open');
        }
    }

    focusFirst(container) {
        const target = container.querySelector('[data-autofocus]') || container.querySelector('button');
        // Wait for the visibility transition to start so focus is allowed
        requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }

    toggleHelp() {
        this.helpCard.classList.toggle('is-open');
    }

    hideLoading() {
        $('loading').classList.add('is-done');
    }

    /**
     * @param {object} result
     * @param {boolean} result.success
     * @param {number} result.time - Seconds
     * @param {number} result.distance - Meters walked along the rope
     * @param {number} result.ropeLength
     * @param {number} result.maxWindPercent
     * @param {boolean} result.newBestTime
     * @param {boolean} result.newBestDistance
     */
    showResult(result) {
        const screen = this.screens.result;
        screen.dataset.result = result.success ? 'success' : 'fail';

        $('result-eyebrow').textContent = result.success ? 'Run complete' : 'Lost your footing';
        $('result-heading').textContent = result.success ? 'Summit reached' : 'You fell';
        const remaining = Math.max(0, Math.round(result.ropeLength - result.distance));
        $('result-sub').textContent = result.success
            ? `Crossed on ${DIFFICULTY_LABELS[this.settings.get('difficulty')]} difficulty.`
            : `${remaining} m short of the far summit. Lean into the wind earlier.`;

        $('stat-time').textContent = formatTime(result.time);
        $('stat-distance').textContent = `${Math.round(result.distance)} / ${Math.round(result.ropeLength)} m`;
        $('stat-wind').textContent = `${Math.round(result.maxWindPercent)}%`;

        const badge = $('result-badge');
        const badgeText = result.newBestTime ? 'New best time!' : result.newBestDistance ? 'New best distance!' : '';
        badge.textContent = badgeText;
        badge.classList.toggle('is-visible', badgeText !== '');

        this.openModal('result');
        this.announce(`${$('result-heading').textContent}. Time ${formatTime(result.time)}.`);
        this.renderRecords();
    }

    showNotification(message, duration = 2500) {
        clearTimeout(this.toastTimer);
        this.toast.textContent = message;
        this.toast.classList.add('is-visible');
        this.toastTimer = setTimeout(() => this.toast.classList.remove('is-visible'), duration);
    }

    announce(text) {
        this.liveRegion.textContent = text;
    }

    /**
     * Called at the start of every run
     */
    newRun() {
        this.prompts.newRun();
        this.helpCard.classList.remove('is-open');
    }

    // ------------------------------------------------------------------
    // Per-frame HUD
    // ------------------------------------------------------------------

    updateHud() {
        const game = this.game;
        const character = game.character;
        const physics = game.physics;
        const input = game.input.getState();
        const rightX = character.getRight(this._right).x;
        const onRope = character.isOnRope;
        const balance = physics.balance;

        this.routeStrip.update({
            time: game.runTime,
            progress: character.progress,
            ropeLength: game.environment.ropeLength
        });

        this.balanceGauge.update({
            balance,
            left: input.left && onRope,
            right: input.right && onRope,
            active: onRope
        });

        const upcoming = physics.upcomingGust;
        const gust = onRope && upcoming ? upcoming.wind * rightX : null;
        this.windWidget.update({
            lateral: physics.wind * rightX,
            maxWind: physics.config.maxWind,
            gust
        });

        // Red vignette and a slight shake when close to falling
        const danger = onRope ? Math.max(0, (Math.abs(balance) - 0.55) / 0.45) : 0;
        const opacity = (Math.round(danger * 20) / 20) * 0.9;
        if (opacity !== this.last.vignette) {
            this.last.vignette = opacity;
            this.vignette.style.opacity = String(opacity);
        }
        this.root.classList.toggle('is-shaking', onRope && Math.abs(balance) > 0.85);

        this.prompts.show(this.selectPrompt(gust !== null));
        this.touchControls.setOnRope(onRope);
    }

    /**
     * Which tutorial hint fits the current moment
     */
    selectPrompt(gustIncoming) {
        const game = this.game;
        const character = game.character;
        if (!this.settings.get('hints') || game.phase !== 'PLAY') return null;

        if (character.isOnRope) {
            if (game.ropeTime < 5) return 'balance';
            if (gustIncoming) return 'gust';
            return null;
        }
        if (character.mode === 'PLATFORM') {
            if (character.distanceToRopeStart < 3.2) return 'stepOn';
            if (game.runTime < 6) return 'walk';
        }
        return null;
    }
}

export { UIManager };
