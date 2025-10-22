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
    this.scrollHandler = null;
  }

  /**
   * Sürekli tarama modunu başlat
   */
  start() {
    // 1. İlk tarama
    setTimeout(() => this.scan(), 100);
    
    // 2. Periyodik tarama (2 saniyede bir)
    this.scanInterval = setInterval(() => this.scan(), 2000);

    // 3. DOM observer
    this.observer = DOMUtils.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => this.scan(), 1000);
    });

    // 4. Scroll listener
    this.scrollHandler = DOMUtils.debounce(() => this.scan(), 500);
    window.addEventListener('scroll', this.scrollHandler);

    console.log('[EditScanner] ➡️ Sürekli tarama başlatıldı');
  }

  /**
   * Edit'leri tara
   */
  scan() {
    const editedPrompts = DOMUtils.getEditedPrompts();
    
    if (editedPrompts.length > 0 || this.lastCount !== editedPrompts.length) {
      this.lastCount = editedPrompts.length;
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

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.observerTimeout) {
      clearTimeout(this.observerTimeout);
    }

    console.log('[EditScanner] 🛑 Tarama durduruldu');
  }
}

export default EditScanner;
