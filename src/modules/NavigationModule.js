/**
 * NavigationModule - Mesajlar arası navigasyon
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';

class NavigationModule extends BaseModule {
  constructor() {
    super('navigation');
    
    this.messages = [];
    this.currentIndex = -1;
    this.observerTimeout = null;
    this.scrollTimeout = null;
  }

  async init() {
    await super.init();
    
    if (!this.enabled) return;

    this.log('Navigation başlatılıyor...');

    // UI oluştur
    this.createUI();

    // Mesajları bul
    this.findMessages();

    // DOM değişikliklerini izle
    this.observeMessages();

    // Klavye kısayolları
    if (this.getSetting('keyboardShortcuts')) {
      this.setupKeyboardShortcuts();
    }

    // Scroll listener
    this.setupScrollListener();

    this.log(`✅ ${this.messages.length} mesaj bulundu`);
  }

  destroy() {
    // Observer'ı durdur
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    super.destroy();
  }

  createUI() {
    // Container oluştur
    const position = this.getSetting('position') || 'right';
    const showCounter = this.getSetting('showCounter');

    const container = this.dom.createElement('div', {
      id: 'claude-nav-buttons',
      className: 'claude-nav-buttons',
      style: {
        position: 'fixed',
        [position]: '30px',
        bottom: '100px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        opacity: this.getSetting('opacity') || 0.7,
        transition: 'opacity 0.2s ease',
      }
    });

    // Top button
    const topBtn = this.createButton('⇈', 'En üste git (Alt+Home)', () => this.navigateToTop());
    topBtn.id = 'claude-nav-top';

    // Previous button
    const prevBtn = this.createButton('↑', 'Önceki mesaj (Alt+↑)', () => this.navigatePrevious());
    prevBtn.id = 'claude-nav-prev';

    // Next button
    const nextBtn = this.createButton('↓', 'Sonraki mesaj (Alt+↓)', () => this.navigateNext());
    nextBtn.id = 'claude-nav-next';

    // Counter badge
    if (showCounter) {
      const counter = this.dom.createElement('div', {
        id: 'claude-nav-counter',
        className: 'claude-nav-counter',
        textContent: '0/0',
        style: {
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          background: '#ff4757',
          color: 'white',
          borderRadius: '12px',
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: 'bold',
          minWidth: '20px',
          textAlign: 'center',
        }
      });
      prevBtn.appendChild(counter);
    }

    container.appendChild(topBtn);
    container.appendChild(prevBtn);
    container.appendChild(nextBtn);

    // Hover effect
    container.addEventListener('mouseenter', () => {
      container.style.opacity = '1';
    });
    container.addEventListener('mouseleave', () => {
      container.style.opacity = this.getSetting('opacity') || 0.7;
    });

    document.body.appendChild(container);
    this.elements.container = container;
    this.elements.topBtn = topBtn;
    this.elements.prevBtn = prevBtn;
    this.elements.nextBtn = nextBtn;
  }

  createButton(icon, tooltip, onClick) {
    // Tema renklerini al
    const theme = this.getTheme();

    const btn = this.dom.createElement('button', {
      className: 'claude-nav-btn',
      innerHTML: icon,
      'data-tooltip': tooltip,
      style: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: theme.gradient,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        color: 'white',
        fontSize: '20px',
        fontWeight: 'bold',
        position: 'relative',
      }
    });

    btn.addEventListener('click', onClick);

    // Hover effects
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.25)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'scale(0.95)';
    });

    btn.addEventListener('mouseup', () => {
      btn.style.transform = 'scale(1.1)';
    });

    return btn;
  }

  findMessages() {
    this.messages = this.dom.findMessages();
    this.updateCounter();
    this.emit(Events.MESSAGES_UPDATED, this.messages);
  }

  observeMessages() {
    this.observer = this.dom.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        const oldLength = this.messages.length;
        this.findMessages();
        if (this.messages.length !== oldLength) {
          this.log(`Mesaj sayısı güncellendi: ${oldLength} → ${this.messages.length}`);
        }
      }, 500);
    });
  }

  navigatePrevious() {
    if (this.messages.length === 0) return;

    this.currentIndex = this.dom.getCurrentVisibleMessageIndex();
    
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.scrollToMessage(this.currentIndex);
      this.emit(Events.NAVIGATION_PREV, this.currentIndex);
    }
  }

  navigateNext() {
    if (this.messages.length === 0) return;

    this.currentIndex = this.dom.getCurrentVisibleMessageIndex();
    
    if (this.currentIndex < this.messages.length - 1) {
      this.currentIndex++;
      this.scrollToMessage(this.currentIndex);
      this.emit(Events.NAVIGATION_NEXT, this.currentIndex);
    }
  }

  navigateToTop() {
    if (this.messages.length === 0) return;

    this.currentIndex = 0;
    this.scrollToMessage(0);
    this.emit(Events.NAVIGATION_TOP, 0);
  }

  scrollToMessage(index) {
    if (index < 0 || index >= this.messages.length) return;

    const message = this.messages[index];
    
    // Smooth scroll ayarı kontrol et
    const smoothScroll = this.getSetting('smoothScroll');
    if (smoothScroll) {
      this.dom.scrollToElement(message, 'center');
    } else {
      message.scrollIntoView({ block: 'center' });
    }

    // Highlight
    const duration = this.getSetting('highlightDuration') || 2000;
    this.dom.flashClass(message, 'claude-nav-highlight', duration);
    
    this.updateCounter();
    this.emit(Events.MESSAGE_SCROLLED, { index, message });

    this.log(`Mesaj ${index + 1}/${this.messages.length} gösteriliyor`);
  }

  updateCounter() {
    const counter = document.getElementById('claude-nav-counter');
    if (!counter) return;

    if (this.messages.length > 0) {
      const current = this.dom.getCurrentVisibleMessageIndex() + 1;
      counter.textContent = `${current}/${this.messages.length}`;
    } else {
      counter.textContent = '0/0';
    }

    // Butonları enable/disable et
    this.updateButtonStates();
  }

  updateButtonStates() {
    const { prevBtn, nextBtn, topBtn } = this.elements;
    if (!prevBtn || !nextBtn || !topBtn) return;

    const currentIdx = this.dom.getCurrentVisibleMessageIndex();
    
    prevBtn.disabled = currentIdx === 0 || this.messages.length === 0;
    nextBtn.disabled = currentIdx === this.messages.length - 1 || this.messages.length === 0;
    topBtn.disabled = this.messages.length === 0;

    // Disabled style
    [prevBtn, nextBtn, topBtn].forEach(btn => {
      if (btn.disabled) {
        btn.style.opacity = '0.3';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    });
  }

  setupKeyboardShortcuts() {
    const handleKeydown = (e) => {
      // Alt + Arrow Up
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigatePrevious();
      }
      
      // Alt + Arrow Down
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateNext();
      }
      
      // Alt + Home
      if (e.altKey && e.key === 'Home') {
        e.preventDefault();
        this.navigateToTop();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    
    // Cleanup için sakla
    this.keydownHandler = handleKeydown;
    this.unsubscribers.push(() => {
      document.removeEventListener('keydown', handleKeydown);
    });

    this.log('Klavye kısayolları aktif');
  }

  setupScrollListener() {
    const handleScroll = this.dom.throttle(() => {
      this.updateCounter();
    }, 100);

    window.addEventListener('scroll', handleScroll);
    
    this.unsubscribers.push(() => {
      window.removeEventListener('scroll', handleScroll);
    });
  }

  onSettingsChanged(settings) {
    this.log('Settings güncellendi:', settings);

    // Pozisyon değişti mi?
    if (this.elements.container) {
      const position = settings.position || 'right';
      this.elements.container.style.left = position === 'left' ? '30px' : 'auto';
      this.elements.container.style.right = position === 'right' ? '30px' : 'auto';
    }

    // Opacity değişti mi?
    if (this.elements.container && settings.opacity !== undefined) {
      this.elements.container.style.opacity = settings.opacity;
    }

    // Counter göster/gizle
    const counter = document.getElementById('claude-nav-counter');
    if (counter) {
      counter.style.display = settings.showCounter ? 'block' : 'none';
    }

    // Klavye kısayolları değişti mi?
    if (settings.keyboardShortcuts !== this.getSetting('keyboardShortcuts')) {
      if (settings.keyboardShortcuts) {
        this.setupKeyboardShortcuts();
      } else if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
      }
    }
    
    // Tema değişti mi? (general ayarlarından kontrol et)
    if (this.settings && this.settings.general) {
      this.recreateUI();
    }
  }

  /**
   * UI'ı yeniden oluştur (tema değişikliğinde)
   */
  recreateUI() {
    // Eski container'ı kaldır
    if (this.elements.container) {
      this.elements.container.remove();
    }

    // Yeni container oluştur
    this.createUI();

    // Button state'lerini güncelle
    this.updateButtonStates();

    this.log('🎨 UI tema ile yenilendi');
  }
}

export default NavigationModule;
