/**
 * NavigationModule - Mesajlar arası navigasyon
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import VisibilityManager from '../utils/VisibilityManager.js';
import Button from '../components/primitives/Button.js';
import Badge from '../components/primitives/Badge.js';
import tokens from '../components/theme/tokens.js';

class NavigationModule extends BaseModule {
  constructor() {
    super('navigation');

    this.messages = [];
    this.currentIndex = -1;
    this.observerTimeout = null;
    this.scrollTimeout = null;
    this.lastCounterText = ''; // Track counter to avoid unnecessary updates
    this.lastButtonStates = { prev: null, next: null, top: null }; // Track button states
    this.lastMessageCount = 0; // Track message count for performance
    this.lastConversationState = null; // Track conversation page state
    this.visibilityUnsubscribe = null; // Store unsubscribe function
  }

  async init() {
    await super.init();

    if (!this.enabled) return;

    this.log('Navigation başlatılıyor...');

    // UI oluştur
    this.createUI();

    // Subscribe to visibility changes
    this.visibilityUnsubscribe = VisibilityManager.onVisibilityChange((isConversationPage) => {
      this.handleVisibilityChange(isConversationPage);
    });

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

  /**
   * Handle visibility change from VisibilityManager
   */
  handleVisibilityChange(isConversationPage) {
    // Only update if state actually changed
    if (this.lastConversationState === isConversationPage) return;

    this.lastConversationState = isConversationPage;

    if (this.elements.container) {
      VisibilityManager.setElementVisibility(this.elements.container, isConversationPage);
    }

    if (!isConversationPage) {
      this.log('Page changed to non-conversation, hiding navigation');
      this.messages = [];
      this.lastMessageCount = 0;
    } else {
      this.log('Page changed to conversation, showing navigation');
      // Re-find messages on conversation page
      this.findMessages();
    }
  }

  destroy() {
    // Unsubscribe from visibility changes
    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
    }

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

    // Counter badge using Badge component
    if (showCounter) {
      const theme = this.getTheme();
      // Counter badge - use accent color (turuncu) for native theme (same as EmojiMarkerModule)
      const counterBg = theme.useNativeClasses
        ? (theme.accentColor || 'hsl(var(--accent-main-000)/var(--tw-bg-opacity))')
        : '#CC785C';

      const counter = Badge.create({
        id: 'claude-nav-counter',
        content: '0/0',
        variant: 'primary',
        size: 'sm',
        position: { top: -8, right: -8 },
        style: {
          fontSize: '10px',
          minWidth: '20px',
          background: counterBg  // Set background based on theme
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
    const theme = this.getTheme();

    // Use Button component for consistent styling
    return Button.create({
      variant: 'fixed',
      icon: icon,
      title: tooltip,
      onClick: onClick,
      className: 'claude-nav-btn',
      style: {
        width: '48px',
        height: '48px',
        fontSize: '20px',
        position: 'relative'
      },
      useNativeClasses: theme.useNativeClasses
    });
  }

  findMessages() {
    // Yeni findActualMessages kullanılıyor (DOMUtils otomatik olarak yönlendiriyor)
    this.messages = this.dom.findMessages();

    // İlk başlatmada her zaman emit et
    if (this.lastMessageCount === 0) {
      this.lastMessageCount = this.messages.length;
      this.updateCounter();
      this.emit(Events.MESSAGES_UPDATED, this.messages);
    } else {
      // Sadece counter'ı güncelle
      this.updateCounter();
    }
  }

  observeMessages() {
    this.observer = this.dom.observeDOM(() => {
      // Don't process if not on conversation page
      if (!this.lastConversationState) return;

      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        const oldLength = this.messages.length;
        this.messages = this.dom.findMessages();

        // SADECE mesaj sayısı değiştiğinde emit et ve UI güncelle
        if (this.messages.length !== oldLength) {
          this.log(`Mesaj sayısı güncellendi: ${oldLength} → ${this.messages.length}`);
          this.updateCounter();
          this.emit(Events.MESSAGES_UPDATED, this.messages);
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

    let newText;
    if (this.messages.length > 0) {
      const current = this.dom.getCurrentVisibleMessageIndex() + 1;
      newText = `${current}/${this.messages.length}`;
    } else {
      newText = '0/0';
    }

    // Only update if text changed
    if (this.lastCounterText !== newText) {
      // Use Badge.update for consistency
      Badge.update(counter, newText);
      this.lastCounterText = newText;
    }

    // Butonları enable/disable et
    this.updateButtonStates();
  }

  updateButtonStates() {
    const { prevBtn, nextBtn, topBtn } = this.elements;
    if (!prevBtn || !nextBtn || !topBtn) return;

    const currentIdx = this.dom.getCurrentVisibleMessageIndex();

    const newStates = {
      prev: currentIdx === 0 || this.messages.length === 0,
      next: currentIdx === this.messages.length - 1 || this.messages.length === 0,
      top: this.messages.length === 0
    };

    // Only update if states changed
    if (newStates.prev !== this.lastButtonStates.prev) {
      prevBtn.disabled = newStates.prev;
      prevBtn.style.opacity = newStates.prev ? '0.3' : '1';
      prevBtn.style.cursor = newStates.prev ? 'not-allowed' : 'pointer';
      this.lastButtonStates.prev = newStates.prev;
    }

    if (newStates.next !== this.lastButtonStates.next) {
      nextBtn.disabled = newStates.next;
      nextBtn.style.opacity = newStates.next ? '0.3' : '1';
      nextBtn.style.cursor = newStates.next ? 'not-allowed' : 'pointer';
      this.lastButtonStates.next = newStates.next;
    }

    if (newStates.top !== this.lastButtonStates.top) {
      topBtn.disabled = newStates.top;
      topBtn.style.opacity = newStates.top ? '0.3' : '1';
      topBtn.style.cursor = newStates.top ? 'not-allowed' : 'pointer';
      this.lastButtonStates.top = newStates.top;
    }
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
    // Increase throttle from 100ms to 300ms for better performance
    const handleScroll = this.dom.throttle(() => {
      this.updateCounter();
    }, 300);

    window.addEventListener('scroll', handleScroll, { passive: true });

    this.unsubscribers.push(() => {
      window.removeEventListener('scroll', handleScroll);
    });
  }

  onSettingsChanged(settings) {
    this.log('Settings güncellendi:', settings);

    // Only update position if it actually changed
    if (this.elements.container && settings.navigation) {
      const newPosition = settings.navigation.position || 'right';
      const currentLeft = this.elements.container.style.left;
      const currentRight = this.elements.container.style.right;

      const shouldBeLeft = newPosition === 'left';
      const isCurrentlyLeft = currentLeft === '30px';

      if (shouldBeLeft !== isCurrentlyLeft) {
        this.elements.container.style.left = shouldBeLeft ? '30px' : 'auto';
        this.elements.container.style.right = shouldBeLeft ? 'auto' : '30px';
      }
    }

    // Only update opacity if it actually changed
    if (this.elements.container && settings.general && settings.general.opacity !== undefined) {
      const newOpacity = settings.general.opacity.toString();
      if (this.elements.container.style.opacity !== newOpacity) {
        this.elements.container.style.opacity = newOpacity;
      }
    }

    // Counter göster/gizle - only if changed
    const counter = document.getElementById('claude-nav-counter');
    if (counter && settings.navigation) {
      const shouldShow = settings.navigation.showCounter;
      const currentDisplay = counter.style.display;
      const targetDisplay = shouldShow ? 'block' : 'none';

      if (currentDisplay !== targetDisplay) {
        counter.style.display = targetDisplay;
      }
    }

    // Klavye kısayolları değişti mi?
    if (settings.navigation && settings.navigation.keyboardShortcuts !== this.getSetting('keyboardShortcuts')) {
      if (settings.navigation.keyboardShortcuts) {
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

  /**
   * Reinitialize UI on SPA navigation
   */
  reinitializeUI() {
    this.log('🔄 Reinitializing Navigation for new page...');

    // Find messages on new page
    this.findMessages();

    // Update counter and button states
    this.updateCounter();
    this.updateButtonStates();

    this.log('✅ Navigation reinitialized');
  }
}

export default NavigationModule;
