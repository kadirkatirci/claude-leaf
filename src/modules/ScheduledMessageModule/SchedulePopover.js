import { SCHEDULE_CLASSNAMES, SCHEDULE_PRESETS } from './constants.js';
import { getPresetDatetimeValue } from './ScheduleState.js';

const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 8;

function stopPropagation(event) {
  event.stopPropagation();
}

function stopAndActivate(event, callback) {
  event.preventDefault();
  event.stopPropagation();
  callback();
}

export default class SchedulePopover {
  constructor() {
    this.element = null;
    this.removeOutsideClick = null;
    this.outsideClickTimer = null;
    this.removeViewportListeners = null;
    this.viewportHandler = null;
  }

  positionPopover(popover, anchorButton) {
    const anchorRect = anchorButton.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    const maxHeight = Math.max(160, viewportHeight - VIEWPORT_MARGIN * 2);
    popover.style.maxHeight = `${maxHeight}px`;
    popover.style.overflowY = 'auto';

    const measuredRect = popover.getBoundingClientRect();
    const popoverWidth = measuredRect.width || popover.offsetWidth || 240;
    const popoverHeight = Math.min(measuredRect.height || popover.scrollHeight || 0, maxHeight);

    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - popoverWidth - VIEWPORT_MARGIN);
    const preferredLeft = anchorRect.left - 12;
    const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), maxLeft);

    const spaceAbove = anchorRect.top - VIEWPORT_MARGIN - ANCHOR_GAP;
    const spaceBelow = viewportHeight - anchorRect.bottom - VIEWPORT_MARGIN - ANCHOR_GAP;

    let top;
    if (spaceBelow >= popoverHeight || spaceBelow > spaceAbove) {
      top = anchorRect.bottom + ANCHOR_GAP;
    } else {
      top = anchorRect.top - popoverHeight - ANCHOR_GAP;
    }

    const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - popoverHeight - VIEWPORT_MARGIN);
    top = Math.min(Math.max(top, VIEWPORT_MARGIN), maxTop);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.visibility = 'visible';
  }

  bindViewportListeners(popover, anchorButton) {
    this.removeViewportListeners?.();

    this.viewportHandler = () => {
      if (!this.element || !document.body.contains(anchorButton)) {
        this.close();
        return;
      }

      this.positionPopover(popover, anchorButton);
    };

    window.addEventListener('resize', this.viewportHandler);
    window.addEventListener('scroll', this.viewportHandler, true);
    this.removeViewportListeners = () => {
      window.removeEventListener('resize', this.viewportHandler);
      window.removeEventListener('scroll', this.viewportHandler, true);
      this.viewportHandler = null;
      this.removeViewportListeners = null;
    };
  }

  open({ anchorButton, hasPendingSchedule = false, onPresetSelect, onDatetimeSelect, onClose }) {
    this.close();

    const popover = document.createElement('div');
    popover.className = `${SCHEDULE_CLASSNAMES.popover} fixed z-[1000] rounded-2xl border border-border-300 bg-bg-000 p-3 shadow-xl`;
    popover.style.width = '240px';
    popover.style.maxWidth = `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`;
    popover.style.visibility = 'hidden';
    popover.style.left = `${VIEWPORT_MARGIN}px`;
    popover.style.top = `${VIEWPORT_MARGIN}px`;

    const presetButtons = SCHEDULE_PRESETS.map(
      preset => `
        <button
          type="button"
          class="cl-schedule-preset w-full rounded-lg px-2 py-1.5 text-left text-sm text-text-200 hover:bg-bg-200"
          data-delay-ms="${preset.delayMs}"
        >
          In ${preset.label}
        </button>
      `
    ).join('');

    popover.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="text-sm font-semibold text-text-100">${hasPendingSchedule ? 'Reschedule message' : 'Schedule message'}</div>
        <div class="flex flex-col gap-1">${presetButtons}</div>
        <div class="mt-1 border-t border-border-300 pt-2">
          <label class="mb-1 block text-xs text-text-400" for="cl-schedule-datetime">Exact time</label>
          <input
            id="cl-schedule-datetime"
            type="datetime-local"
            class="w-full rounded-lg border border-border-300 bg-bg-100 px-2 py-1.5 text-sm text-text-100"
            value="${getPresetDatetimeValue()}"
          />
          <button
            type="button"
            class="mt-2 w-full rounded-lg bg-bg-200 px-2 py-1.5 text-sm text-text-100 hover:bg-bg-300"
            id="cl-schedule-confirm-datetime"
          >
            Confirm time
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(popover);
    this.element = popover;
    this.positionPopover(popover, anchorButton);
    this.bindViewportListeners(popover, anchorButton);
    popover.addEventListener('pointerdown', stopPropagation);
    popover.addEventListener('click', stopPropagation);

    popover.querySelectorAll('[data-delay-ms]').forEach(button => {
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener('click', event => {
        const delayMs = Number(button.getAttribute('data-delay-ms'));
        stopAndActivate(event, () => onPresetSelect(delayMs));
      });
    });

    popover
      .querySelector('#cl-schedule-confirm-datetime')
      ?.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
      });
    popover.querySelector('#cl-schedule-confirm-datetime')?.addEventListener('click', event => {
      const rawValue = popover.querySelector('#cl-schedule-datetime')?.value;
      if (!rawValue) {
        return;
      }
      stopAndActivate(event, () => onDatetimeSelect(rawValue));
    });

    popover.querySelector('#cl-schedule-datetime')?.addEventListener('click', stopPropagation);
    popover
      .querySelector('#cl-schedule-datetime')
      ?.addEventListener('pointerdown', stopPropagation);

    const outsideClickListener = event => {
      if (popover.contains(event.target) || anchorButton.contains(event.target)) {
        return;
      }

      this.close();
      onClose?.();
    };

    this.removeOutsideClick = () => {
      document.removeEventListener('click', outsideClickListener, true);
    };

    this.outsideClickTimer = setTimeout(() => {
      document.addEventListener('click', outsideClickListener, true);
    }, 0);
  }

  close() {
    if (this.outsideClickTimer) {
      clearTimeout(this.outsideClickTimer);
      this.outsideClickTimer = null;
    }
    this.removeViewportListeners?.();
    this.removeOutsideClick?.();
    this.removeOutsideClick = null;
    this.element?.remove();
    this.element = null;
  }
}
