/**
 * Shared helpers for floating button/panel visibility.
 * Centralizes the existing display/visibility/pointer-events/opacity contract.
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
