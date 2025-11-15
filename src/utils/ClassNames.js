/**
 * ClassNames - Claude Native CSS class utilities
 * Helper functions for building native class strings
 */

/**
 * Combines class names, filtering out falsy values
 * @param {...(string|false|null|undefined)} classes - Class names or conditionals
 * @returns {string} Combined class string
 *
 * @example
 * cn('base-class', isActive && 'active', 'another-class')
 * // Returns: 'base-class active another-class' if isActive is true
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Common Claude native class presets for reusability
 */
export const ClaudeClasses = {
  // Buttons
  button: {
    base: 'inline-flex items-center justify-center cursor-pointer transition-all',
    fixed: 'z-[1] size-9 border-0.5 overflow-hidden !rounded-full p-1 shadow-md hover:shadow-lg bg-bg-000/80 hover:bg-bg-000 backdrop-blur transition-opacity duration-200 border-border-300 opacity-100 pointer-events-auto',
    primary: 'px-3 py-1.5 rounded-md bg-accent-main-100 hover:bg-accent-main-200 text-white text-sm font-semibold shadow-sm hover:shadow-md hover:scale-105',
    secondary: 'px-3 py-1.5 rounded-md bg-bg-100 hover:bg-bg-200 text-text-000 text-sm transition-colors',
    danger: 'px-3 py-1.5 rounded text-white text-sm transition-colors', // Note: backgroundColor must be set via inline style (#ef4444)
    icon: 'size-9 text-xl border border-border-300 rounded-md bg-bg-100 hover:bg-bg-200 flex items-center justify-center hover:scale-110',
    small: 'size-8 text-lg border border-border-300 rounded-md bg-bg-100 hover:bg-bg-200 flex items-center justify-center hover:scale-110',
  },

  // Cards & Panels
  card: {
    base: 'p-3 mb-2 bg-bg-100 hover:bg-bg-200 rounded-md cursor-pointer transition-colors',
    withBorder: 'p-3 mb-2 border-l-4 border-accent-main-100 bg-bg-100 hover:bg-bg-200 rounded-md cursor-pointer transition-colors',
    noPadding: 'bg-bg-100 hover:bg-bg-200 rounded-md cursor-pointer transition-colors',
  },

  panel: {
    base: 'absolute bg-bg-000 border-2 border-accent-main-100 rounded-xl shadow-xl z-[10000]',
    modal: 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-000 border-2 border-accent-main-100 rounded-xl shadow-2xl z-[10000]',
    dropdown: 'absolute flex flex-col gap-2 p-3 bg-bg-000 border-2 border-accent-main-100 rounded-xl shadow-xl z-[10000]',
  },

  // Layout
  layout: {
    flex: 'flex',
    flexCol: 'flex flex-col',
    flexRow: 'flex flex-row',
    flexWrap: 'flex flex-wrap',
    gap1: 'gap-1',
    gap2: 'gap-2',
    gap3: 'gap-3',
    itemsCenter: 'items-center',
    justifyBetween: 'justify-between',
    justifyCenter: 'justify-center',
  },

  // Text
  text: {
    primary: 'text-text-000',
    secondary: 'text-text-300',
    muted: 'text-text-400',
    accent: 'text-accent-main-100',
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    bold: 'font-bold',
    semibold: 'font-semibold',
    truncate: 'truncate',
  },

  // Inputs
  input: {
    base: 'px-3 py-2 border border-border-300 rounded-md bg-bg-100 text-text-000 text-sm outline-none focus:border-accent-main-100',
    search: 'px-3 py-2 border border-border-300 rounded-md bg-bg-100 text-text-000 text-sm outline-none focus:border-accent-main-100 transition-colors',
  },

  // Badges
  badge: {
    base: 'px-2 py-1 rounded-md text-xs font-semibold',
    accent: 'px-2 py-1 rounded-md bg-accent-main-100 text-white text-xs font-semibold',
    neutral: 'px-2 py-1 rounded-md bg-bg-200 text-text-000 text-xs font-semibold',
    // Smaller counter for fixed buttons (navigation, bookmarks, etc.)
    counter: 'absolute -top-1 -right-1 px-1 py-0.5 rounded-full bg-accent-main-100 text-white text-[10px] font-bold min-w-[18px] leading-none text-center',
  },

  // Menus & Dropdowns
  menu: {
    container: 'absolute top-full right-0 mt-1 bg-bg-000 border border-border-300 rounded-lg shadow-lg p-2 flex flex-col gap-1 z-50 min-w-[120px]',
    item: 'px-3 py-1.5 rounded bg-bg-100 hover:bg-bg-200 text-text-000 cursor-pointer text-sm text-left transition-colors',
    itemDanger: 'px-3 py-1.5 rounded text-white cursor-pointer text-sm text-left transition-colors', // Note: backgroundColor must be set via inline style (#ef4444) with hover listeners
  },

  // Utility
  util: {
    shadow: 'shadow-md',
    shadowLg: 'shadow-lg',
    shadowXl: 'shadow-xl',
    rounded: 'rounded-md',
    roundedLg: 'rounded-lg',
    roundedXl: 'rounded-xl',
    roundedFull: 'rounded-full',
    cursorPointer: 'cursor-pointer',
    selectNone: 'select-none',
    transition: 'transition-all',
    transitionColors: 'transition-colors',
  },

  // Positioning
  position: {
    absolute: 'absolute',
    relative: 'relative',
    fixed: 'fixed',
    sticky: 'sticky',
  },

  // Visibility
  visibility: {
    hidden: 'opacity-0 pointer-events-none',
    visible: 'opacity-100 pointer-events-auto',
  },
};

/**
 * Builds a button class string with common patterns
 * @param {'fixed'|'primary'|'secondary'|'danger'|'icon'|'small'} variant - Button variant
 * @param {string} additionalClasses - Additional classes
 * @returns {string}
 */
export function buttonClass(variant = 'primary', additionalClasses = '') {
  return cn(ClaudeClasses.button.base, ClaudeClasses.button[variant], additionalClasses);
}

/**
 * Builds a card class string
 * @param {boolean} withBorder - Include left border
 * @param {string} additionalClasses - Additional classes
 * @returns {string}
 */
export function cardClass(withBorder = false, additionalClasses = '') {
  const base = withBorder ? ClaudeClasses.card.withBorder : ClaudeClasses.card.base;
  return cn(base, additionalClasses);
}

/**
 * Builds a panel class string
 * @param {'base'|'modal'|'dropdown'} variant - Panel variant
 * @param {string} additionalClasses - Additional classes
 * @returns {string}
 */
export function panelClass(variant = 'base', additionalClasses = '') {
  return cn(ClaudeClasses.panel[variant], additionalClasses);
}

/**
 * Builds a flex layout class string
 * @param {'row'|'col'} direction - Flex direction
 * @param {number} gap - Gap size (1-3)
 * @param {string} additionalClasses - Additional classes
 * @returns {string}
 */
export function flexClass(direction = 'row', gap = 2, additionalClasses = '') {
  const dir = direction === 'col' ? ClaudeClasses.layout.flexCol : ClaudeClasses.layout.flexRow;
  const gapClass = ClaudeClasses.layout[`gap${gap}`] || ClaudeClasses.layout.gap2;
  return cn(dir, gapClass, additionalClasses);
}

/**
 * Builds a text class string
 * @param {Object} options - Text options
 * @param {'primary'|'secondary'|'muted'|'accent'} options.color - Text color
 * @param {'xs'|'sm'|'base'|'lg'|'xl'|'2xl'} options.size - Text size
 * @param {'bold'|'semibold'} options.weight - Font weight
 * @param {boolean} options.truncate - Truncate text
 * @param {string} additionalClasses - Additional classes
 * @returns {string}
 */
export function textClass({ color = 'primary', size = 'base', weight, truncate = false } = {}, additionalClasses = '') {
  return cn(
    ClaudeClasses.text[color],
    ClaudeClasses.text[size],
    weight && ClaudeClasses.text[weight],
    truncate && ClaudeClasses.text.truncate,
    additionalClasses
  );
}

export default {
  cn,
  ClaudeClasses,
  buttonClass,
  cardClass,
  panelClass,
  flexClass,
  textClass,
};
