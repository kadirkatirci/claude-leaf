/**
 * DOMUtils - Claude web arayüzü için DOM yardımcı fonksiyonları
 */

const DOMUtils = {
  /**
   * Claude mesajlarını bul
   * @returns {HTMLElement[]} Mesaj elementleri
   */
  findMessages() {
    // Claude'un mesaj yapısı için multiple selector dene
    const selectors = [
      '[data-test-render-count]', // Claude'un ana mesaj container'ı
      '.font-claude-message',
      '[class*="Message"]',
      '[role="article"]',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }

    // Fallback: Ana container'daki büyük blokları bul
    const chatContainer = this.getChatContainer();
    if (chatContainer) {
      const allDivs = chatContainer.querySelectorAll('div');
      return Array.from(allDivs).filter(div => {
        return div.offsetHeight > 100 && div.textContent.trim().length > 50;
      });
    }

    return [];
  },

  /**
   * Ana chat container'ı bul
   * @returns {HTMLElement|null}
   */
  getChatContainer() {
    return document.querySelector('main') || 
           document.querySelector('[role="main"]') ||
           document.querySelector('#chat-container') ||
           document.body;
  },

  /**
   * Kullanıcı mesajlarını bul
   * @returns {HTMLElement[]}
   */
  getUserMessages() {
    const allMessages = this.findMessages();
    // TODO: Kullanıcı ve Claude mesajlarını ayırt et
    // Bu, Claude'un DOM yapısına göre güncellenmeli
    return allMessages.filter((_, index) => index % 2 === 0);
  },

  /**
   * Claude cevaplarını bul
   * @returns {HTMLElement[]}
   */
  getClaudeMessages() {
    const allMessages = this.findMessages();
    // TODO: Kullanıcı ve Claude mesajlarını ayırt et
    return allMessages.filter((_, index) => index % 2 === 1);
  },

  /**
   * Edit edilmiş promptları bul
   * Claude'un edit ikonlarına sahip mesajları tespit eder
   * @returns {Array<{element: HTMLElement, editButton: HTMLElement, versionInfo: string}>}
   */
  getEditedPrompts() {
    const edited = [];
    
    // Tüm render-count elementlerini bul (her biri bir mesaj grubu)
    const messageContainers = document.querySelectorAll('[data-test-render-count]');
    
    messageContainers.forEach(container => {
      // Bu container içinde kullanıcı mesajı var mı?
      const userMessage = container.querySelector('[data-testid="user-message"]');
      if (!userMessage) return;

      // Version counter'ı ara ("örn: 3 / 3")
      // Container içindeki tüm span'leri kontrol et
      const allSpans = container.querySelectorAll('span');
      let versionSpan = null;
      
      for (const span of allSpans) {
        const text = span.textContent.trim();
        if (/^\d+\s*\/\s*\d+$/.test(text)) {
          versionSpan = span;
          break;
        }
      }

      if (versionSpan) {
        const versionText = versionSpan.textContent.trim();
        const parts = versionText.split('/');
        
        if (parts.length === 2) {
          const current = parseInt(parts[0].trim());
          const total = parseInt(parts[1].trim());

          // Sadece toplam > 1 ise edit yapılmış demektir
          if (total > 1 && !isNaN(current) && !isNaN(total)) {
            // Edit butonunu bul (retry button - circular arrow icon)
            const retryButton = container.querySelector('button svg path[d*="M10.3857"]')?.closest('button');
            
            edited.push({
              element: container,
              editButton: retryButton,
              versionInfo: versionText,
              currentVersion: current,
              totalVersions: total,
              hasEditHistory: true,
              // Debug bilgisi
              containerId: container.getAttribute('data-test-render-count')
            });
          }
        }
      }
    });
    
    return edited;
  },

  /**
   * Bir mesajın edit history'sini bul
   * @param {HTMLElement} messageElement
   * @returns {Object|null} Edit history bilgisi
   */
  getEditHistory(messageElement) {
    if (!messageElement) return null;

    // Claude'un edit sisteminde, edit yapılmış mesajlarda
    // genelde version bilgisi veya edit badge'i bulunur
    
    // 1. Edit badge'i ara
    const editBadge = messageElement.querySelector('[class*="edit" i][class*="badge" i]');
    
    // 2. Version indicator ara
    const versionText = messageElement.querySelector('[class*="version" i]');
    
    // 3. Timestamp ara (edited at...)
    const timestamp = messageElement.querySelector('[class*="edited" i][class*="time" i]');

    return {
      hasHistory: !!(editBadge || versionText || timestamp),
      badge: editBadge,
      version: versionText?.textContent,
      timestamp: timestamp?.textContent,
      element: messageElement
    };
  },

  /**
   * Bir mesajın kullanıcı mesajı olup olmadığını kontrol et
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isUserMessage(element) {
    if (!element) return false;
    
    // Claude'un kullanıcı mesajları genelde belirli class'lara sahip
    const indicators = [
      element.querySelector('[class*="user" i]'),
      element.querySelector('[class*="human" i]'),
      element.getAttribute('data-message-author') === 'user',
      // Genelde sağda hizalı olur
      window.getComputedStyle(element).textAlign === 'right'
    ];
    
    return indicators.some(indicator => indicator);
  },

  /**
   * Markdown başlıklarını parse et
   * @param {HTMLElement} element - Parse edilecek element
   * @returns {Object[]} Başlık listesi {level, text, element}
   */
  parseMarkdownHeadings(element) {
    const headings = [];
    const headingSelectors = 'h1, h2, h3, h4, h5, h6';
    const foundHeadings = element.querySelectorAll(headingSelectors);

    foundHeadings.forEach(heading => {
      headings.push({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent.trim(),
        element: heading,
      });
    });

    return headings;
  },

  /**
   * Element'in görünür olup olmadığını kontrol et
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isElementVisible(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  /**
   * Element'in kısmen görünür olup olmadığını kontrol et
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isElementPartiallyVisible(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    const verticalVisible = rect.top < windowHeight && rect.bottom > 0;
    const horizontalVisible = rect.left < windowWidth && rect.right > 0;

    return verticalVisible && horizontalVisible;
  },

  /**
   * Element'e smooth scroll
   * @param {HTMLElement} element
   * @param {string} block - 'start' | 'center' | 'end'
   */
  scrollToElement(element, block = 'center') {
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: block,
      inline: 'nearest'
    });
  },

  /**
   * Şu anda viewport'ta hangi mesaj var?
   * @returns {number} Mesaj index'i
   */
  getCurrentVisibleMessageIndex() {
    const messages = this.findMessages();
    const scrollPosition = window.scrollY + window.innerHeight / 2;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const rect = msg.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const elementBottom = elementTop + rect.height;

      if (scrollPosition >= elementTop && scrollPosition <= elementBottom) {
        return i;
      }
    }

    // En yakın mesajı bul
    let closest = 0;
    let minDistance = Infinity;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const rect = msg.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const distance = Math.abs(scrollPosition - elementTop);

      if (distance < minDistance) {
        minDistance = distance;
        closest = i;
      }
    }

    return closest;
  },

  /**
   * MutationObserver ile DOM değişikliklerini izle
   * @param {Function} callback - Değişiklik olduğunda çağrılacak
   * @param {HTMLElement} target - İzlenecek element (default: main)
   * @returns {MutationObserver} Observer instance
   */
  observeDOM(callback, target = null) {
    const targetNode = target || this.getChatContainer();

    const config = {
      childList: true,
      subtree: true,
      attributes: false,
    };

    const observer = new MutationObserver((mutations) => {
      callback(mutations);
    });

    observer.observe(targetNode, config);
    return observer;
  },

  /**
   * Debounce fonksiyonu
   * @param {Function} func - Debounce edilecek fonksiyon
   * @param {number} wait - Bekleme süresi (ms)
   * @returns {Function}
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle fonksiyonu
   * @param {Function} func - Throttle edilecek fonksiyon
   * @param {number} limit - Limit süresi (ms)
   * @returns {Function}
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Element'e CSS class ekle/çıkar (animasyon ile)
   * @param {HTMLElement} element
   * @param {string} className
   * @param {number} duration - Class'ın kalma süresi (ms)
   */
  flashClass(element, className, duration = 2000) {
    if (!element) return;

    element.classList.add(className);
    setTimeout(() => {
      element.classList.remove(className);
    }, duration);
  },

  /**
   * CSS inject et
   * @param {string} css - CSS string
   * @param {string} id - Style element ID (optional)
   */
  injectCSS(css, id = null) {
    const style = document.createElement('style');
    if (id) style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  },

  /**
   * Element oluştur (helper)
   * @param {string} tag - HTML tag
   * @param {Object} attrs - Attribute'ler
   * @param {string} content - İçerik
   * @returns {HTMLElement}
   */
  createElement(tag, attrs = {}, content = '') {
    const element = document.createElement(tag);
    
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });

    if (content) {
      element.innerHTML = content;
    }

    return element;
  },
};

export default DOMUtils;
