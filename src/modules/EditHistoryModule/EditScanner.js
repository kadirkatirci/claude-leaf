/**
 * EditScanner - Edit tarama ve tespit mantığı
 */
import DOMUtils from '../../utils/DOMUtils.js';

class EditScanner {
  constructor(onEditFound) {
    this.onEditFound = onEditFound;
    this.observer = null;
    this.observerTimeout = null;
    this.scanInterval = null;
    this.lastCount = 0;
    this.lastEditIds = new Set(); // Track edit IDs to detect actual changes
  }

  /**
   * Sürekli tarama modunu başlat
   * Optimized: Removed scroll listener, increased interval
   */
  start() {
    // 1. İlk tarama
    setTimeout(() => this.scan(), 100);

    // 2. Periyodik tarama (5 saniyede bir - daha az sık)
    this.scanInterval = setInterval(() => this.scan(), 5000);

    // 3. DOM observer (sadece bu yeterli)
    this.observer = DOMUtils.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => this.scan(), 1000);
    });

    console.log('[EditScanner] ➡️ Sürekli tarama başlatıldı (optimized)');
  }

  /**
   * Edit'leri tara
   * Only calls onEditFound if edits actually changed
   */
  scan() {
    const editedPrompts = DOMUtils.getEditedPrompts();

    // Create ID set for comparison
    const currentIds = new Set(editedPrompts.map(e => e.containerId));

    // Check if edits changed
    const idsChanged =
      currentIds.size !== this.lastEditIds.size ||
      [...currentIds].some(id => !this.lastEditIds.has(id));

    // Only notify if edits actually changed
    if (idsChanged) {
      this.lastCount = editedPrompts.length;
      this.lastEditIds = currentIds;
      this.onEditFound(editedPrompts);
    }
  }

  /**
   * Taramayı durdur
   */
  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
    }

    console.log('[EditScanner] 🛑 Tarama durduruldu');
  }
}

export default EditScanner;
