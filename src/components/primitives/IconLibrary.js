/**
 * IconLibrary - Centralized SVG icon library
 * Provides consistent SVG icons across all modules
 * All icons use currentColor for automatic theme adaptation
 */

export default class IconLibrary {
  /**
   * Get bookmark icon
   * @param {boolean} filled - Whether to use filled or stroked version
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static bookmark(filled = false, color = 'currentColor', size = 16) {
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
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 24)
   * @returns {string} SVG markup
   */
  static close(color = 'currentColor', size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M6 6L18 18M6 18L18 6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Get chevron icon
   * @param {string} direction - Direction ('up', 'down', 'left', 'right')
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static chevron(direction = 'down', color = 'currentColor', size = 16) {
    const rotations = {
      up: 180,
      down: 0,
      left: 90,
      right: 270,
    };

    const rotation = rotations[direction] || 0;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle; transform: rotate(${rotation}deg);">
      <path d="M6 9L12 15L18 9" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get edit/pencil icon (NEW - replaces ✏️)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 20)
   * @returns {string} SVG markup
   */
  static edit(color = 'currentColor', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M15.2141 5.98239L16.6158 4.58063C17.39 3.80646 18.6452 3.80646 19.4194 4.58063C20.1935 5.3548 20.1935 6.60998 19.4194 7.38415L18.0176 8.78591M15.2141 5.98239L6.98023 14.2163C5.93493 15.2616 5.41226 15.7842 5.05637 16.4211C4.70047 17.058 4.3424 18.5619 4 20C5.43809 19.6576 6.94199 19.2995 7.57889 18.9436C8.21579 18.5877 8.73844 18.0651 9.78375 17.0198L18.0176 8.78591M15.2141 5.98239L18.0176 8.78591" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11 20H17" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Get pin/marker icon (NEW - replaces 📍)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 20)
   * @returns {string} SVG markup
   */
  static pin(color = 'currentColor', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M5 16C3.7492 16.6327 3 17.4385 3 18.3158C3 20.3505 7.02944 22 12 22C16.9706 22 21 20.3505 21 18.3158C21 17.4385 20.2508 16.6327 19 16" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 10V17" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="6" r="4" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get arrow up double icon (NEW - replaces ⇈)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 20)
   * @returns {string} SVG markup
   */
  static arrowUpDouble(color = 'currentColor', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M18 11.5C18 11.5 13.5811 5.50001 12 5.5C10.4188 5.49999 6 11.5 6 11.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 18.5C18 18.5 13.5811 12.5 12 12.5C10.4188 12.5 6 18.5 6 18.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get arrow up icon (NEW - replaces ↑)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 20)
   * @returns {string} SVG markup
   */
  static arrowUp(color = 'currentColor', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M17.9998 15C17.9998 15 13.5809 9.00001 11.9998 9C10.4187 8.99999 5.99985 15 5.99985 15" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get arrow down icon (NEW - replaces ↓)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 20)
   * @returns {string} SVG markup
   */
  static arrowDown(color = 'currentColor', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get navigation icon (NEW - replaces 🧭)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static navigation(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="1.5"/>
      <path d="M9.3 8.5V15.5M9.3 8.5C8.58465 8.5 7.5 10.25 7.5 10.25M9.3 8.5C10.004 8.5 11.1 10.25 11.1 10.25M14.7 15.5V8.5M14.7 15.5C13.996 15.5 12.9 13.75 12.9 13.75M14.7 15.5C15.404 15.5 16.5 13.75 16.5 13.75" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get collapse icon (NEW - replaces 📦)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 20)
   * @returns {string} SVG markup
   */
  static collapse(color = 'currentColor', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M6.50232 13.2635C7.34673 13.2515 10.1432 12.6706 10.7361 13.2635C11.329 13.8564 10.7481 16.6529 10.7361 17.4973M13.2685 6.49733C13.2565 7.34173 12.6756 10.1382 13.2685 10.7311C13.8614 11.324 16.6579 10.7431 17.5023 10.7311M20.9991 2.99902L13.6103 10.3812M10.3691 13.6237L3 21.001" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get expand icon (NEW - replaces 📂)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 20)
   * @returns {string} SVG markup
   */
  static expand(color = 'currentColor', size = 20) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M16.4999 3.26621C17.3443 3.25421 20.1408 2.67328 20.7337 3.26621C21.3266 3.85913 20.7457 6.65559 20.7337 7.5M20.5059 3.49097L13.5021 10.4961" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3.26636 16.5001C3.25436 17.3445 2.67343 20.141 3.26636 20.7339C3.85928 21.3268 6.65574 20.7459 7.50015 20.7339M10.502 13.4976L3.49824 20.5027" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get open-in-new / external link icon
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static openInNew(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M14 5H19V10" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 14L19 5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19 14V16.2C19 17.8802 19 18.7202 18.673 19.362C18.3854 19.9265 17.9265 20.3854 17.362 20.673C16.7202 21 15.8802 21 14.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V9.8C3 8.11984 3 7.27976 3.32698 6.63803C3.6146 6.07354 4.07354 5.6146 4.63803 5.32698C5.27976 5 6.11984 5 7.8 5H10" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get menu collapse icon (NEW - replaces 📄)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static menuCollapse(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M3 6H17" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 12H13" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 18H17" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M21 8L19.8462 8.87652C17.9487 10.318 17 11.0388 17 12C17 12.9612 17.9487 13.682 19.8462 15.1235L21 16" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get arrow up solid icon (NEW - replaces 📑)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static arrowUpSolid(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M20 16.5H4L12 7.5L20 16.5Z" fill="${color}"/>
    </svg>`;
  }

  /**
   * Get settings icon (NEW - replaces ⚙️)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static settings(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M15.5 11.5C15.5 13.433 13.933 15 12 15C10.067 15 8.5 13.433 8.5 11.5C8.5 9.567 10.067 8 12 8C13.933 8 15.5 9.567 15.5 11.5Z" stroke="${color}" stroke-width="1.5"/>
      <path d="M21 13.5995C21.3155 13.5134 21.6503 13.4669 22 13.4669V9.53324C19.1433 9.53324 17.2857 6.43041 18.732 3.96691L15.2679 2.0001C13.8038 4.49405 10.1978 4.49395 8.73363 2L5.26953 3.96681C6.71586 6.43035 4.85673 9.53324 2 9.53324V13.4669C4.85668 13.4669 6.71425 16.5697 5.26795 19.0332L8.73205 21C9.46434 19.7527 10.7321 19.1289 12 19.1286" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18.5 15L18.7579 15.697C19.0961 16.611 19.2652 17.068 19.5986 17.4014C19.932 17.7348 20.389 17.9039 21.303 18.2421L22 18.5L21.303 18.7579C20.389 19.0961 19.932 19.2652 19.5986 19.5986C19.2652 19.932 19.0961 20.389 18.7579 21.303L18.5 22L18.2421 21.303C17.9039 20.389 17.7348 19.932 17.4014 19.5986C17.068 19.2652 16.611 19.0961 15.697 18.7579L15 18.5L15.697 18.2421C16.611 17.9039 17.068 17.7348 17.4014 17.4014C17.7348 17.068 17.9039 16.611 18.2421 15.697L18.5 15Z" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get download icon (NEW - replaces 📤)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static download(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.5 10.5C15.5 10.5 12.9223 14 12 14C11.0777 14 8.5 10.5 8.5 10.5M12 13.5V6.99997M8.5 17H15.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get upload icon (NEW - replaces 📥)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static upload(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.5 10.5C15.5 10.5 12.9223 7.00001 12 7C11.0777 6.99999 8.5 10.5 8.5 10.5M12 7.5V14M8.5 17H15.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get delete icon (NEW - replaces 🗑️)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static deleteIcon(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 11.7349H15" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M10.5 15.6543H13.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M3 5.5H21M16.0555 5.5L15.3729 4.09173C14.9194 3.15626 14.6926 2.68852 14.3015 2.39681C14.2148 2.3321 14.1229 2.27454 14.0268 2.2247C13.5937 2 13.0739 2 12.0343 2C10.9686 2 10.4358 2 9.99549 2.23412C9.89791 2.28601 9.80479 2.3459 9.7171 2.41317C9.32145 2.7167 9.10044 3.20155 8.65842 4.17126L8.05273 5.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }

  /**
   * Get add icon (NEW - replaces ➕)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static add(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M2.5 12.0001C2.5 7.52171 2.5 5.28254 3.89124 3.8913C5.28249 2.50005 7.52166 2.50005 12 2.50005C16.4783 2.50005 18.7175 2.50005 20.1088 3.8913C21.5 5.28254 21.5 7.52171 21.5 12.0001C21.5 16.4784 21.5 18.7176 20.1088 20.1088C18.7175 21.5001 16.4783 21.5001 12 21.5001C7.52166 21.5001 5.28249 21.5001 3.89124 20.1088C2.5 18.7176 2.5 16.4784 2.5 12.0001Z" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 8.00005V16.0001M16 12.0001L8 12.0001" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get refresh icon (NEW - replaces 🔄)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static refresh(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M20.0092 2V5.13219C20.0092 5.42605 19.6418 5.55908 19.4537 5.33333C17.6226 3.2875 14.9617 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get checkmark icon (NEW - replaces 💾)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static checkmark(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M17 3.33782C15.5291 2.48697 13.8214 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 11.3151 21.9311 10.6462 21.8 10" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 12.5C8 12.5 9.5 12.5 11.5 16C11.5 16 17.0588 6.83333 22 5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get map icon (NEW - replaces 🗺️)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static map(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path opacity="0.4" fill-rule="evenodd" clip-rule="evenodd" d="M7.25 2.91797C7.25 2.71164 7.25 2.60847 7.19842 2.53228C7.15658 2.47049 7.0775 2.41885 7.0041 2.4054C6.9136 2.38881 6.82783 2.42648 6.65628 2.50183C6.61935 2.51804 6.5823 2.53476 6.54509 2.55194C6.08426 2.76478 5.55432 3.07221 4.90724 3.44759L3.6187 4.19507C3.15062 4.46658 2.75247 4.69753 2.44084 4.92256C2.10848 5.16256 1.82705 5.42806 1.61998 5.79155C1.4134 6.15416 1.32728 6.53279 1.28746 6.94309C1.24997 7.32946 1.24999 7.7958 1.25 8.34694V16.586C1.24999 17.3151 1.24998 17.918 1.29639 18.3895C1.34327 18.8656 1.44676 19.3439 1.75833 19.7305C2.09802 20.1519 2.57688 20.4384 3.11024 20.5336C3.60335 20.6216 4.0707 20.4737 4.5015 20.2792C4.92742 20.0869 5.49919 19.7552 6.11822 19.3961C6.40134 19.2318 6.6546 19.0849 6.89091 18.9628C7.07195 18.8692 7.16247 18.8225 7.20624 18.7506C7.25 18.6787 7.25 18.5841 7.25 18.395V17.918C7.25 17.5038 7.58579 17.168 8 17.168C8.41422 17.168 8.75 17.5038 8.75 17.918V18.2663C8.75 18.4689 8.75 18.5702 8.7977 18.6444C8.84539 18.7185 8.94451 18.7637 9.14275 18.854C9.36402 18.9548 9.6448 19.0928 10.0237 19.2812L13.8376 21.1776C14.0293 21.273 14.25 21.1321 14.25 20.918C14.25 20.5038 14.5858 20.168 15 20.168C15.4142 20.168 15.75 20.5038 15.75 20.918V21.5584C15.75 21.619 15.799 21.668 15.8595 21.668L18.0529 21.668C18.9506 21.668 19.7008 21.668 20.2966 21.5862C20.9275 21.4995 21.4955 21.3086 21.9503 20.8438C22.4028 20.3812 22.5866 19.8073 22.6704 19.1705C22.7501 18.5647 22.75 17.8009 22.75 16.8809V10.0382C22.75 9.11824 22.7501 8.35437 22.6704 7.74864C22.5866 7.11176 22.4028 6.53787 21.9503 6.07535C21.4955 5.61054 20.9275 5.41964 20.2966 5.33296C19.7008 5.25107 18.9506 5.2511 18.0529 5.25113L15.9214 5.25113C15.8268 5.25113 15.75 5.32768 15.75 5.42221V5.91797C15.75 6.33219 15.4142 6.66797 15 6.66797C14.5858 6.66797 14.25 6.33219 14.25 5.91797V5.16235C14.25 4.98151 14.25 4.89108 14.205 4.81848C14.16 4.74588 14.0791 4.70562 13.9171 4.6251L11.1426 3.24551C10.4736 2.91286 9.92553 2.64034 9.45232 2.45776C9.43389 2.45065 9.4155 2.44365 9.39715 2.43675C9.15787 2.34684 9.03822 2.30189 8.92442 2.35434C8.89519 2.36781 8.86203 2.39078 8.83913 2.41341C8.75 2.50148 8.75 2.64031 8.75 2.91797C8.75 3.33219 8.41422 3.66797 8 3.66797C7.58579 3.66797 7.25 3.33219 7.25 2.91797ZM8.75 5.91797C8.75 5.50376 8.41422 5.16797 8 5.16797C7.58579 5.16797 7.25 5.50376 7.25 5.91797V6.91797C7.25 7.33219 7.58579 7.66797 8 7.66797C8.41422 7.66797 8.75 7.33219 8.75 6.91797V5.91797ZM15.75 8.91797C15.75 8.50376 15.4142 8.16797 15 8.16797C14.5858 8.16797 14.25 8.50376 14.25 8.91797V9.91797C14.25 10.3322 14.5858 10.668 15 10.668C15.4142 10.668 15.75 10.3322 15.75 9.91797V8.91797ZM8.75 9.91797C8.75 9.50376 8.41422 9.16797 8 9.16797C7.58579 9.16797 7.25 9.50376 7.25 9.91797V10.918C7.25 11.3322 7.58579 11.668 8 11.668C8.41422 11.668 8.75 11.3322 8.75 10.918V9.91797ZM15.75 12.918C15.75 12.5038 15.4142 12.168 15 12.168C14.5858 12.168 14.25 12.5038 14.25 12.918V13.918C14.25 14.3322 14.5858 14.668 15 14.668C15.4142 14.668 15.75 14.3322 15.75 13.918V12.918ZM8.75 13.918C8.75 13.5038 8.41422 13.168 8 13.168C7.58579 13.168 7.25 13.5038 7.25 13.918V14.918C7.25 15.3322 7.58579 15.668 8 15.668C8.41422 15.668 8.75 15.3322 8.75 14.918V13.918ZM15.75 16.918C15.75 16.5038 15.4142 16.168 15 16.168C14.5858 16.168 14.25 16.5038 14.25 16.918V17.918C14.25 18.3322 14.5858 18.668 15 18.668C15.4142 18.668 15.75 18.3322 15.75 17.918V16.918Z" fill="${color}"/>
      <path d="M8.75 17.918C8.75 17.5038 8.41421 17.168 8 17.168V15.668C8.41421 15.668 8.75 15.3322 8.75 14.918V13.918C8.75 13.5038 8.41421 13.168 8 13.168V11.668C8.41421 11.668 8.75 11.3322 8.75 10.918V9.91797C8.75 9.50376 8.41421 9.16797 8 9.16797V7.66797C8.41421 7.66797 8.75 7.33219 8.75 6.91797V5.91797C8.75 5.50376 8.41421 5.16797 8 5.16797V3.66797C8.41421 3.66797 8.75 3.33219 8.75 2.91797C8.75 2.64031 8.75 2.50148 8.83913 2.41341C8.86202 2.39078 8.89519 2.36781 8.92442 2.35434C9.03822 2.30189 9.15786 2.34684 9.39715 2.43675L9.45232 2.45776C9.92553 2.64034 10.4736 2.91286 11.1426 3.24551L13.9171 4.6251C14.0791 4.70562 14.16 4.74588 14.205 4.81848C14.25 4.89108 14.25 4.98151 14.25 5.16235V5.91797C14.25 6.33219 14.5858 6.66797 15 6.66797V8.16797C14.5858 8.16797 14.25 8.50376 14.25 8.91797V9.91797C14.25 10.3322 14.5858 10.668 15 10.668V12.168C14.5858 12.168 14.25 12.5038 14.25 12.918V13.918C14.25 14.3322 14.5858 14.668 15 14.668V16.168C14.5858 16.168 14.25 16.5038 14.25 16.918V17.918C14.25 18.3322 14.5858 18.668 15 18.668V20.168C14.5858 20.168 14.25 20.5038 14.25 20.918C14.25 21.1321 14.0293 21.273 13.8376 21.1776L10.0237 19.2812C9.64479 19.0928 9.36402 18.9548 9.14275 18.854C8.94451 18.7637 8.84539 18.7185 8.7977 18.6444C8.75 18.5702 8.75 18.4689 8.75 18.2663V17.918Z" fill="${color}"/>
    </svg>`;
  }

  /**
   * Get simple check icon (NEW)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static check(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M20 6L9 17L4 12" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /**
   * Get trash icon (NEW - alias for deleteIcon)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static trash(color = 'currentColor', size = 16) {
    return this.deleteIcon(color, size);
  }

  /**
   * Get grid icon (for grid view toggle)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static grid(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="${color}" stroke-width="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="${color}" stroke-width="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="${color}" stroke-width="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="${color}" stroke-width="1.5"/>
    </svg>`;
  }

  /**
   * Get list icon (for list view toggle)
   * @param {string} color - Color for the icon (default: currentColor)
   * @param {number} size - Icon size (default: 16)
   * @returns {string} SVG markup
   */
  static list(color = 'currentColor', size = 16) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display: inline-block; vertical-align: middle;">
      <path d="M8 6H21" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 12H21" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 18H21" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="4" cy="6" r="1" fill="${color}"/>
      <circle cx="4" cy="12" r="1" fill="${color}"/>
      <circle cx="4" cy="18" r="1" fill="${color}"/>
    </svg>`;
  }

  /**
   * Get icon by name (convenience method)
   * @param {string} name - Icon name
   * @param {Object} options - Options {color, size, filled, direction}
   * @returns {string} SVG markup
   */
  static get(name, options = {}) {
    const { color = 'currentColor', size = 16, filled = false, direction = 'down' } = options;

    switch (name) {
      case 'bookmark':
        return this.bookmark(filled, color, size);
      case 'close':
        return this.close(color, size);
      case 'chevron':
        return this.chevron(direction, color, size);
      case 'edit':
        return this.edit(color, size);
      case 'pin':
        return this.pin(color, size);
      case 'arrow-up-double':
        return this.arrowUpDouble(color, size);
      case 'arrow-up':
        return this.arrowUp(color, size);
      case 'arrow-down':
        return this.arrowDown(color, size);
      case 'navigation':
        return this.navigation(color, size);
      case 'collapse':
        return this.collapse(color, size);
      case 'expand':
        return this.expand(color, size);
      case 'open-in-new':
        return this.openInNew(color, size);
      case 'menu-collapse':
        return this.menuCollapse(color, size);
      case 'arrow-up-solid':
        return this.arrowUpSolid(color, size);
      case 'settings':
        return this.settings(color, size);
      case 'download':
        return this.download(color, size);
      case 'upload':
        return this.upload(color, size);
      case 'delete':
        return this.deleteIcon(color, size);
      case 'add':
        return this.add(color, size);
      case 'refresh':
        return this.refresh(color, size);
      case 'checkmark':
        return this.checkmark(color, size);
      case 'check':
        return this.check(color, size);
      case 'map':
        return this.map(color, size);
      case 'trash':
        return this.trash(color, size);
      case 'grid':
        return this.grid(color, size);
      case 'list':
        return this.list(color, size);
      default:
        console.warn(`[IconLibrary] Unknown icon: ${name}`);
        return '';
    }
  }
}
