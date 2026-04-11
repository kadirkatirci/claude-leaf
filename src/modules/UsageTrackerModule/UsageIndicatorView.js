import { USAGE_CLASSNAMES } from './constants.js';
import { hasRenderableUsage } from './UsageState.js';

function getFillColor(tone, variant) {
  if (tone === 'danger') {
    return 'rgba(220, 38, 38, 0.5)';
  }
  if (tone === 'warning') {
    return 'rgba(217, 119, 6, 0.42)';
  }
  if (variant === 'session') {
    return 'rgba(8, 145, 178, 0.42)';
  }
  return 'rgba(37, 99, 235, 0.3)';
}

function getTrackColor(tone, variant) {
  if (tone === 'danger') {
    return 'rgba(220, 38, 38, 0.14)';
  }
  if (tone === 'warning') {
    return 'rgba(217, 119, 6, 0.12)';
  }
  if (variant === 'session') {
    return 'rgba(8, 145, 178, 0.12)';
  }
  return 'rgba(37, 99, 235, 0.1)';
}

function ensurePositionContext(element) {
  if (!element) {
    return null;
  }

  if (window.getComputedStyle(element).position !== 'static') {
    return {
      changed: false,
      previousPosition: element.style.position,
    };
  }

  element.style.position = 'relative';
  return {
    changed: true,
    previousPosition: '',
  };
}

export default class UsageIndicatorView {
  constructor() {
    this.positionSnapshots = new WeakMap();
  }

  render(container, state) {
    if (!container) {
      return null;
    }

    if (!hasRenderableUsage(state)) {
      this.clear(container);
      return null;
    }

    let root = container.querySelector(`.${USAGE_CLASSNAMES.root}`);
    if (!root) {
      const snapshot = ensurePositionContext(container);
      if (snapshot) {
        this.positionSnapshots.set(container, snapshot);
      }

      root = document.createElement('div');
      root.className = USAGE_CLASSNAMES.root;
      root.setAttribute('aria-hidden', 'true');
      root.style.position = 'absolute';
      root.style.inset = '0';
      root.style.pointerEvents = 'none';
      root.style.borderRadius = 'inherit';
      root.style.overflow = 'hidden';
      root.style.zIndex = '0';
      root.innerHTML = `
        <div
          class="${USAGE_CLASSNAMES.line}"
          data-usage-kind="session"
          style="position:absolute;left:0;right:0;top:0;height:1px;border-radius:999px;overflow:hidden;pointer-events:none;"
        >
          <div
            class="${USAGE_CLASSNAMES.fill}"
            data-usage-fill="session"
            style="height:100%;width:0%;border-radius:999px;transition:width 180ms ease, background-color 180ms ease;"
          ></div>
        </div>
        <div
          class="${USAGE_CLASSNAMES.line}"
          data-usage-kind="weekly"
          style="position:absolute;left:0;right:0;bottom:0;height:1px;border-radius:999px;overflow:hidden;pointer-events:none;"
        >
          <div
            class="${USAGE_CLASSNAMES.fill}"
            data-usage-fill="weekly"
            style="height:100%;width:0%;border-radius:999px;transition:width 180ms ease, background-color 180ms ease;"
          ></div>
        </div>
      `;
      container.insertBefore(root, container.firstChild);
    }

    this.paintLine(root, state.session, 'session');
    this.paintLine(root, state.weekly, 'weekly');

    return root;
  }

  paintLine(root, usageWindow, kind) {
    const line = root.querySelector(`[data-usage-kind="${kind}"]`);
    const fill = root.querySelector(`[data-usage-fill="${kind}"]`);
    if (!line || !fill) {
      return;
    }

    if (!usageWindow) {
      line.style.display = 'none';
      fill.style.width = '0%';
      line.removeAttribute('title');
      line.removeAttribute('aria-label');
      return;
    }

    line.style.display = '';
    line.setAttribute('title', usageWindow.title);
    line.setAttribute('aria-label', usageWindow.title);
    line.style.background = getTrackColor(usageWindow.tone, kind);
    fill.style.width = `${Math.round(usageWindow.percent)}%`;
    fill.style.background = getFillColor(usageWindow.tone, kind);
  }

  clear(container) {
    const root = container?.querySelector(`.${USAGE_CLASSNAMES.root}`);
    if (root) {
      root.remove();
    }

    const snapshot = this.positionSnapshots.get(container);
    if (snapshot?.changed) {
      container.style.position = snapshot.previousPosition;
      this.positionSnapshots.delete(container);
    }
  }
}
