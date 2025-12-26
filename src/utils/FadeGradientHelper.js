/**
 * FadeGradientHelper - Shared utility for theme-aware fade gradients
 * Provides consistent gradient effects across ContentFolding module
 */
import DOMUtils from './DOMUtils.js';

export class FadeGradientHelper {
  /**
   * Add fade gradient to container
   * @param {HTMLElement} container - Element to add gradient to
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} Created gradient element
   */
  static add(container, options = {}) {
    const {
      height = '60px',
      className = 'fold-gradient',
      zIndex = '5',
      stops = [
        { position: '0%', opacity: 0 },
        { position: '100%', opacity: 1 },
      ],
    } = options;

    // Remove existing gradient
    this.remove(container, className);

    // Get computed background from body for theme awareness
    const computedBg =
      window.getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)';

    // Build gradient stops
    const gradientStops = stops
      .map(stop => {
        if (stop.opacity === 0) {
          return `transparent ${stop.position}`;
        }

        // Convert rgb to rgba with specified opacity
        const rgba = computedBg.replace('rgb', 'rgba').replace(')', `, ${stop.opacity})`);
        return `${rgba} ${stop.position}`;
      })
      .join(', ');

    // Create gradient element
    const gradient = DOMUtils.createElement('div', {
      className,
      style: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height,
        background: `linear-gradient(to bottom, ${gradientStops})`,
        pointerEvents: 'none',
        zIndex,
      },
    });

    container.appendChild(gradient);
    return gradient;
  }

  /**
   * Remove fade gradient from container
   * @param {HTMLElement} container - Container element
   * @param {string} className - Class name of gradient to remove
   */
  static remove(container, className = 'fold-gradient') {
    const gradient = container.querySelector(`.${className}`);
    if (gradient) {
      gradient.remove();
    }
  }
}

export default FadeGradientHelper;
