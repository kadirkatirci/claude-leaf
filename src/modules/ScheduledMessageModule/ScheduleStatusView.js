import { SCHEDULE_CLASSNAMES } from './constants.js';
import { buildFailureMessage, buildPendingStatusLabel } from './ScheduleState.js';

function stopPropagation(event) {
  event.stopPropagation();
}

function stopAndActivate(event, callback) {
  event.preventDefault();
  event.stopPropagation();
  callback();
}

function buildButton(label, variant, id) {
  const variantClass =
    variant === 'danger'
      ? 'border-red-300 text-red-600 hover:bg-red-50'
      : 'border-border-300 text-text-200 hover:bg-bg-200';

  return `
    <button
      type="button"
      class="cl-schedule-status-action rounded-lg border px-2 py-1 text-xs ${variantClass}"
      data-action="${id}"
    >
      ${label}
    </button>
  `;
}

function buildSignature(schedule) {
  return [
    schedule?.id || '',
    schedule?.status || '',
    schedule?.scheduledForMs || '',
    schedule?.retryCount || 0,
    schedule?.lastErrorCode || '',
  ].join(':');
}

function buildTitle(isFailure) {
  return isFailure ? 'Scheduled send failed' : 'Scheduled send active';
}

function buildActionsMarkup(isFailure) {
  if (isFailure) {
    return [
      buildButton('Dismiss', 'default', 'dismiss'),
      buildButton('Reschedule', 'default', 'reschedule'),
    ].join('');
  }

  return [
    buildButton('Cancel', 'danger', 'cancel'),
    buildButton('Reschedule', 'default', 'reschedule'),
    buildButton('Send now', 'default', 'send-now'),
  ].join('');
}

export default class ScheduleStatusView {
  render(container, schedule, actions = {}) {
    if (!container) {
      return null;
    }

    if (!schedule) {
      this.clear(container);
      return null;
    }

    const signature = buildSignature(schedule);
    const isFailure = schedule.status === 'failed' || schedule.status === 'expired_session';
    const message = isFailure ? buildFailureMessage(schedule) : buildPendingStatusLabel(schedule);
    let root = container.querySelector(`.${SCHEDULE_CLASSNAMES.status}`);

    if (!root) {
      root = document.createElement('div');
      root.className = `${SCHEDULE_CLASSNAMES.status} mt-2 flex items-center justify-between gap-2 rounded-xl border border-border-300 bg-bg-100 px-3 py-2 text-xs`;
      root.innerHTML = `
        <div class="min-w-0 flex-1">
          <div class="cl-schedule-status-title font-medium text-text-100"></div>
          <div class="cl-schedule-status-message mt-0.5 text-text-400"></div>
        </div>
        <div class="cl-schedule-status-actions flex shrink-0 items-center gap-1"></div>
      `;
      root.addEventListener('pointerdown', stopPropagation);
      root.addEventListener('click', stopPropagation);
      root.addEventListener('mousedown', stopPropagation);
      root.addEventListener('click', event => {
        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) {
          return;
        }

        const action = actionButton.getAttribute('data-action');
        const callbackMap = root.__scheduleActions || {};
        if (action === 'cancel') {
          stopAndActivate(event, () => callbackMap.onCancel?.());
        }
        if (action === 'reschedule') {
          stopAndActivate(event, () => callbackMap.onReschedule?.());
        }
        if (action === 'send-now') {
          stopAndActivate(event, () => callbackMap.onSendNow?.());
        }
        if (action === 'dismiss') {
          stopAndActivate(event, () => callbackMap.onDismiss?.());
        }
      });
      root.addEventListener('pointerdown', event => {
        if (event.target.closest('[data-action]')) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
      root.addEventListener('mousedown', event => {
        if (event.target.closest('[data-action]')) {
          event.preventDefault();
          event.stopPropagation();
        }
      });
      container.appendChild(root);
    }

    root.__scheduleActions = actions;

    if (root.dataset.signature !== signature) {
      root.dataset.signature = signature;
      root.dataset.mode = isFailure ? 'failure' : 'active';
      root.querySelector('.cl-schedule-status-title').textContent = buildTitle(isFailure);
      root.querySelector('.cl-schedule-status-message').textContent = message;
      root.querySelector('.cl-schedule-status-actions').innerHTML = buildActionsMarkup(isFailure);
    }

    return root;
  }

  clear(container) {
    const root = container?.querySelector(`.${SCHEDULE_CLASSNAMES.status}`);
    if (!root) {
      return;
    }

    delete root.__scheduleActions;
    root.remove();
  }
}
