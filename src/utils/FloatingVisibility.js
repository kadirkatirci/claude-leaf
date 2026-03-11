/**
 * Shared helpers for floating button/panel visibility and layout.
 * Centralizes the existing display/visibility/pointer-events/opacity contract
 * plus the current fixed positioning defaults used by floating UI.
 */

export function applyFloatingVisibility(element, { visible, opacity, display = 'flex' } = {}) {
  if (!element) {
    return;
  }

  element.style.display = visible ? display : 'none';
  element.style.visibility = visible ? 'visible' : 'hidden';
  element.style.pointerEvents = visible ? 'auto' : 'none';
  element.style.opacity = visible ? String(opacity) : '0';
}

export function setFloatingOpacity(element, opacity) {
  if (!element) {
    return;
  }

  element.style.opacity = String(opacity);
}

export function applyFloatingButtonLayout(
  element,
  {
    right,
    top = '50%',
    bottom,
    left,
    transform,
    zIndex = '9999',
    overflow = 'visible',
    transition = 'opacity 0.3s ease',
  } = {}
) {
  if (!element) {
    return;
  }

  const styles = {
    position: 'fixed',
    top,
    zIndex,
    overflow,
    transition,
  };

  if (right !== undefined) {
    styles.right = right;
  }
  if (bottom !== undefined) {
    styles.bottom = bottom;
  }
  if (left !== undefined) {
    styles.left = left;
  }
  if (transform !== undefined) {
    styles.transform = transform;
  }

  Object.assign(element.style, styles);
}

export function getFloatingContainerLayout(
  positionSide = 'right',
  {
    offset = '30px',
    bottom = '100px',
    zIndex = '9999',
    gap = '8px',
    transition = 'opacity 0.3s ease',
  } = {}
) {
  return {
    position: 'fixed',
    [positionSide]: offset,
    bottom,
    zIndex,
    flexDirection: 'column',
    gap,
    transition,
  };
}
