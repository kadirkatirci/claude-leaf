/**
 * IconLibrary - Centralized SVG icon library
 * Provides consistent SVG icons across all modules
 */

export default class IconLibrary {
  /**
   * Get bookmark icon
   * @param {boolean} filled - Whether to use filled or stroked version
   * @param {string} color - Color for the icon
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static bookmark(filled = false, color = '#ffffff', size = 16) {
    if (filled) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M4 4.75C4 3.23122 5.23122 2 6.75 2H17.75C19.2688 2 20.5 3.23122 20.5 4.75V21.75C20.5 22.0135 20.3618 22.2576 20.1359 22.3931C19.91 22.5287 19.6295 22.5357 19.3971 22.4118L12.25 18.6L5.10294 22.4118C4.87049 22.5357 4.59003 22.5287 4.36413 22.3931C4.13822 22.2576 4 22.0135 4 21.75V4.75Z" fill="${color}"/>
      </svg>`;
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
        <path d="M12 17.5L19.5 21.5V4.5C19.5 3.39543 18.6046 2.5 17.5 2.5H6.5C5.39543 2.5 4.5 3.39543 4.5 4.5V21.5L12 17.5Z" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
  }



  /**
   * Get close icon (×)
   * @param {string} color - Color for the icon
   * @param {number} size - Icon size (default: 24)
   * @returns {string} SVG markup
   */
  static close(color = '#ffffff', size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M6 6L18 18M6 18L18 6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Get chevron icon
   * @param {string} direction - Direction ('up', 'down', 'left', 'right')
   * @param {string} color - Color for the icon
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static chevron(direction = 'down', color = '#666', size = 16) {
    const rotations = {
      up: 180,
      down: 0,
      left: 90,
      right: 270
    };

    const rotation = rotations[direction] || 0;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle; transform: rotate(${rotation}deg);">
      <path d="M6 9L12 15L18 9" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get edit/pencil icon
   * @param {string} color - Color for the icon
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static edit(color = '#666', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get marker/pin icon
   * @param {string} color - Color for the icon
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static marker(color = '#666', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="10" r="3" stroke="${color}" stroke-width="2"/>
    </svg>`;
  }

  /**
   * Get navigation arrow icon
   * @param {string} direction - Direction ('up', 'down', 'left', 'right')
   * @param {string} color - Color for the icon
   * @param {number} size - Icon size (default: 20)
   * @returns {string} SVG markup
   */
  static arrow(direction = 'up', color = '#ffffff', size = 20) {
    const paths = {
      up: 'M12 19V5M5 12L12 5L19 12',
      down: 'M12 5V19M5 12L12 19L19 12',
      left: 'M19 12H5M12 5L5 12L12 19',
      right: 'M5 12H19M12 5L19 12L12 19'
    };

    const path = paths[direction] || paths.up;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="${path}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get icon by name (convenience method)
   * @param {string} name - Icon name
   * @param {Object} options - Options {color, size, filled, direction}
   * @returns {string} SVG markup
   */
  static get(name, options = {}) {
    const { color = '#ffffff', size = 16, filled = false, direction = 'down' } = options;

    switch (name) {
      case 'bookmark':
        return this.bookmark(filled, color, size);

      case 'close':
        return this.close(color, size);
      case 'chevron':
        return this.chevron(direction, color, size);
      case 'edit':
        return this.edit(color, size);
      case 'marker':
        return this.marker(color, size);
      case 'arrow':
        return this.arrow(direction, color, size);
      default:
        console.warn(`[IconLibrary] Unknown icon: ${name}`);
        return '';
    }
  }
}
