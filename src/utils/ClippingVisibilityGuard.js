const INLINE_STYLE_REFS = new WeakMap();
const CLIPPED_OVERFLOW_VALUES = new Set(['hidden', 'clip']);
const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay']);

function getInlineStyleState(element) {
  let state = INLINE_STYLE_REFS.get(element);
  if (!state) {
    state = new Map();
    INLINE_STYLE_REFS.set(element, state);
  }
  return state;
}

function hasInlineStyleRef(element, property) {
  return Boolean(INLINE_STYLE_REFS.get(element)?.has(property));
}

function setInlineStyleRef(element, property, value) {
  const state = getInlineStyleState(element);
  const current = state.get(property);

  if (current) {
    current.count += 1;
    return { element, property };
  }

  state.set(property, {
    count: 1,
    previousValue: element.style.getPropertyValue(property),
    previousPriority: element.style.getPropertyPriority(property),
  });
  element.style.setProperty(property, value);

  return { element, property };
}

function restoreInlineStyleRef(element, property) {
  const state = INLINE_STYLE_REFS.get(element);
  const current = state?.get(property);
  if (!current) {
    return;
  }

  current.count -= 1;
  if (current.count > 0) {
    return;
  }

  if (current.previousValue) {
    element.style.setProperty(property, current.previousValue, current.previousPriority || '');
  } else {
    element.style.removeProperty(property);
  }

  state.delete(property);
  if (state.size === 0) {
    INLINE_STYLE_REFS.delete(element);
  }
}

function isScrollableElement(element, computedStyle) {
  return (
    (SCROLLABLE_OVERFLOW_VALUES.has(computedStyle.overflowY) &&
      element.scrollHeight > element.clientHeight + 2) ||
    (SCROLLABLE_OVERFLOW_VALUES.has(computedStyle.overflowX) &&
      element.scrollWidth > element.clientWidth + 2)
  );
}

function shouldOpenOverflow(computedStyle, axes, isScrollContainer) {
  if (isScrollContainer) {
    return false;
  }

  if (
    axes.horizontal &&
    (CLIPPED_OVERFLOW_VALUES.has(computedStyle.overflowX) ||
      CLIPPED_OVERFLOW_VALUES.has(computedStyle.overflow))
  ) {
    return true;
  }

  if (
    axes.vertical &&
    (CLIPPED_OVERFLOW_VALUES.has(computedStyle.overflowY) ||
      CLIPPED_OVERFLOW_VALUES.has(computedStyle.overflow))
  ) {
    return true;
  }

  return false;
}

function isNegativeOffset(value) {
  if (typeof value === 'number') {
    return value < 0;
  }

  if (typeof value !== 'string') {
    return false;
  }

  return value.trim().startsWith('-');
}

export function inferOverflowGuardAxes(position = {}) {
  return {
    horizontal: isNegativeOffset(position.left) || isNegativeOffset(position.right),
    vertical: isNegativeOffset(position.top) || isNegativeOffset(position.bottom),
  };
}

export function protectClippingAncestors(
  anchorElement,
  {
    axes = { horizontal: false, vertical: false },
    maxDepth = 8,
    includeContentVisibility = true,
  } = {}
) {
  if (!anchorElement) {
    return () => {};
  }

  const claims = [];
  let current = anchorElement;
  let depth = 0;

  while (current && current !== document.body && depth < maxDepth) {
    const computedStyle = window.getComputedStyle(current);

    if (
      includeContentVisibility &&
      (computedStyle.contentVisibility === 'auto' ||
        hasInlineStyleRef(current, 'content-visibility'))
    ) {
      claims.push(setInlineStyleRef(current, 'content-visibility', 'visible'));
    }

    if (
      shouldOpenOverflow(computedStyle, axes, isScrollableElement(current, computedStyle)) ||
      hasInlineStyleRef(current, 'overflow')
    ) {
      claims.push(setInlineStyleRef(current, 'overflow', 'visible'));
    }

    current = current.parentElement;
    depth += 1;
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;

    for (let index = claims.length - 1; index >= 0; index -= 1) {
      const claim = claims[index];
      restoreInlineStyleRef(claim.element, claim.property);
    }
  };
}
