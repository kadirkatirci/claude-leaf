/**
 * NavigationModule - Mesajlar arası navigasyon
 * BaseModule'den türetilir
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import MessageObserverMixin from '../core/MessageObserverMixin.js';
import VisibilityManager from '../utils/VisibilityManager.js';
import Button from '../components/primitives/Button.js';
import CounterBadge from '../components/primitives/CounterBadge.js';
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
    this.cachedOpacity = 0.7; // Cached opacity for better UX
    this.hasInitialLoadCompleted = false; // Track if first message load completed
  }

  async init() {
    await super.init();

    if (!this.enabled) return;

    try {
      this.log('Navigation başlatılıyor...');

      // Enhance with MessageObserverMixin
      MessageObserverMixin.enhance(this);

      // UI oluştur
      await this.createUI();

      // Subscribe to visibility changes
      // DO NOT search for messages here - let observer handle it when messages appear
      this.visibilityUnsubscribe = VisibilityManager.onVisibilityChange((isConversationPage) => {
        try {
          this.handleVisibilityChange(isConversationPage);
        } catch (error) {
          console.error(`❌ Error in visibility change handler:`, error);
        }
      });

      // Setup message observer
      // Observer will fire whenever DOM mutations occur (messages added, removed, etc.)
      // Combined with visibility tracking, this gives us full coverage
      this.setupMessageObserver(() => {
        try {
          const oldLength = this.messages.length;
          this.messages = this.dom.findMessages();

          // Update if count changed OR if this is the first successful load
          if (this.messages.length !== oldLength || !this.hasInitialLoadCompleted) {
            this.updateCounter();
            this.emit(Events.MESSAGES_UPDATED, this.messages);

            // Mark initial load as complete if we found messages
            if (!this.hasInitialLoadCompleted && this.messages.length > 0) {
              this.hasInitialLoadCompleted = true;
              this.log(`✅ Initial load from observer: ${this.messages.length} messages`);
            }
          }
        } catch (error) {
          console.error(`❌ Error in message observer callback:`, error);
        }
      }, {
        throttleDelay: 500,
        trackMessageCount: false, // We handle this manually
        checkConversationPage: true
      });

      // Klavye kısayolları
      try {
        if (await this.getSetting('keyboardShortcuts')) {
          this.setupKeyboardShortcuts();
        }
      } catch (error) {
        this.error('Failed to setup keyboard shortcuts:', error);
      }

      // Scroll listener
      try {
        this.setupScrollListener();
      } catch (error) {
        this.error('Failed to setup scroll listener:', error);
      }

      this.log(`✅ ${this.messages.length} mesaj bulundu`);
    } catch (error) {
      this.error('Navigation initialization failed:', error);
      throw error; // Re-throw for App.js to track
    }
  }

  /**
   * Handle visibility change from VisibilityManager
   * When a conversation page is detected, show the UI and trust observer for updates
   */
  handleVisibilityChange(isConversationPage) {
    this.lastConversationState = isConversationPage;

    if (this.elements.container) {
      VisibilityManager.setElementVisibility(this.elements.container, isConversationPage);
    }

    if (!isConversationPage) {
      this.log('📵 Page changed to non-conversation, hiding navigation');
      this.messages = [];
      this.lastMessageCount = 0;
      this.hasInitialLoadCompleted = false; // Reset flag for next conversation
    } else {
      this.log('💬 Page changed to conversation, showing navigation');
      // Wait for messages to appear with retry mechanism
      this.waitForMessagesAndUpdate();
    }
  }

  /**
   * Wait for messages to appear in DOM with retry mechanism
   */
  async waitForMessagesAndUpdate() {
    const maxRetries = 10;
    const baseDelay = 100;
    let retryCount = 0;

    const checkMessages = async () => {
      const messages = this.dom.findMessages();

      if (messages.length > 0 || retryCount >= maxRetries) {
        // Messages found or max retries reached
        this.messages = messages;
        this.updateCounter();
        this.emit(Events.MESSAGES_UPDATED, this.messages);
        this.hasInitialLoadCompleted = true;

        if (messages.length > 0) {
          this.log(`✅ Initial load: Found ${messages.length} messages after ${retryCount} retries`);
        } else {
          this.log(`⚠️ No messages found after ${retryCount} retries`);
        }
        return true;
      }

      // No messages yet, retry with exponential backoff
      retryCount++;
      const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), 1000);
      this.log(`🔄 Retry ${retryCount}/${maxRetries}: Waiting ${delay}ms for messages...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return checkMessages();
    };

    // Start checking
    await checkMessages();
  }

  destroy() {
    // Unsubscribe from visibility changes
    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
    }

    // Destroy message observer
    this.destroyMessageObserver();

    super.destroy();
  }

  async createUI() {
    // Container oluştur
    const position = await this.getSetting('position') || 'right';
    const showCounter = await this.getSetting('showCounter');
    this.cachedOpacity = await this.getSetting('opacity') || 0.7;

    // Determine initial visibility state
    const isConversationPage = VisibilityManager.isOnConversationPage();

    const container = this.dom.createElement('div', {
      id: 'claude-nav-container',
      className: 'claude-nav-buttons',
      'data-nav-container': 'true', // Add data attribute for reliable finding by other modules
      style: {
        position: 'fixed',
        [position]: '30px',
        bottom: '100px',
        zIndex: '9999',
        display: isConversationPage ? 'flex' : 'none', // Initialize visibility
        flexDirection: 'column',
        gap: '8px',
        opacity: this.cachedOpacity,
        transition: 'opacity 0.2s ease',
        visibility: isConversationPage ? 'visible' : 'hidden', // Add visibility property
      }
    });

    // Top button
    const topBtn = this.createButton('⇈', 'En üste git (Alt+Home)', () => this.navigateToTop());
    topBtn.id = 'claude-nav-top';
    // Initialize button as disabled (will be enabled when messages found)
    topBtn.disabled = true;
    topBtn.style.opacity = '0.3';
    topBtn.style.cursor = 'not-allowed';

    // Previous button
    const prevBtn = this.createButton('↑', 'Önceki mesaj (Alt+↑)', () => this.navigatePrevious());
    prevBtn.id = 'claude-nav-prev';
    // Initialize button as disabled (will be enabled when messages found)
    prevBtn.disabled = true;
    prevBtn.style.opacity = '0.3';
    prevBtn.style.cursor = 'not-allowed';

    // Next button
    const nextBtn = this.createButton('↓', 'Sonraki mesaj (Alt+↓)', () => this.navigateNext());
    nextBtn.id = 'claude-nav-next';
    // Initialize button as disabled (will be enabled when messages found)
    nextBtn.disabled = true;
    nextBtn.style.opacity = '0.3';
    nextBtn.style.cursor = 'not-allowed';

    // Counter badge using CounterBadge component
    if (showCounter) {
      CounterBadge.attachTo(prevBtn, {
        id: 'claude-nav-counter',
        content: '0/0',
        theme: this.getTheme(),
        position: { top: -8, right: -8 },
        style: {
          fontSize: '10px',
          minWidth: '20px'
        }
      });
    }

    container.appendChild(topBtn);
    container.appendChild(prevBtn);
    container.appendChild(nextBtn);

    // Hover effect
    container.addEventListener('mouseenter', () => {
      container.style.opacity = '1';
    });
    container.addEventListener('mouseleave', () => {
      container.style.opacity = this.cachedOpacity;
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

  /**
   * Find messages with retry mechanism for page load stability
   */
  async findMessagesWithRetry(maxRetries = 5, delay = 200) {
    // Log diagnostic info on first attempt
    this.log(`🔍 Mesaj arama başlandı (max ${maxRetries} deneme, delay ${delay}ms)`);
    this.log(`📍 URL: ${window.location.pathname}`);
    this.log(`📍 isOnConversationPage: ${this.dom.isOnConversationPage()}`);

    for (let i = 0; i < maxRetries; i++) {
      this.messages = this.dom.findMessages();

      if (this.messages.length > 0) {
        this.updateCounter();
        this.lastMessageCount = this.messages.length;
        this.emit(Events.MESSAGES_UPDATED, this.messages);
        this.log(`✅ ${this.messages.length} mesaj bulundu (deneme ${i + 1}/${maxRetries})`);
        return;
      }

      if (i < maxRetries - 1) {
        this.log(`⏳ Mesaj bulunamadı, tekrar deneniyor (${i + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Last attempt failed - additional diagnostic logging
        this.log(`❌ Son deneme başarısız oldu. DOM kontrol:`, {
          hasMainElement: !!document.querySelector('main'),
          hasRoleMain: !!document.querySelector('[role="main"]'),
          isConversationPage: this.dom.isOnConversationPage(),
          url: window.location.pathname
        });
      }
    }

    // No messages found after all retries
    this.log(`⚠️ ${maxRetries} deneme sonrası mesaj bulunamadı`);
    this.updateCounter(); // Update to show 0/0
  }

  findMessages() {
    // Yeni findActualMessages kullanılıyor (DOMUtils otomatik olarak yönlendiriyor)
    this.messages = this.dom.findMessages();

    // Her zaman counter'ı güncelle
    this.updateCounter();

    // İlk başlatmada veya mesaj sayısı değiştiyse emit et
    if (this.lastMessageCount !== this.messages.length) {
      this.lastMessageCount = this.messages.length;
      this.emit(Events.MESSAGES_UPDATED, this.messages);
    }

    this.log(`${this.messages.length} mesaj bulundu (${this.lastMessageCount} toplam)`);
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

  async scrollToMessage(index) {
    if (index < 0 || index >= this.messages.length) return;

    const message = this.messages[index];

    // Smooth scroll ayarı kontrol et
    const smoothScroll = await this.getSetting('smoothScroll');
    if (smoothScroll) {
      this.dom.scrollToElement(message, 'center');
    } else {
      message.scrollIntoView({ block: 'center' });
    }

    // Highlight
    const duration = await this.getSetting('highlightDuration') || 2000;
    this.dom.flashClass(message, 'claude-nav-highlight', duration);
    
    this.updateCounter();
    this.emit(Events.MESSAGE_SCROLLED, { index, message });

    this.log(`Mesaj ${index + 1}/${this.messages.length} gösteriliyor`);
  }

  updateCounter() {
    let newText;
    if (this.messages.length > 0) {
      const current = this.dom.getCurrentVisibleMessageIndex() + 1;
      newText = `${current}/${this.messages.length}`;
      this.log(`Counter güncelleniyor: ${newText} (current index: ${current - 1})`);
    } else {
      newText = '0/0';
    }

    // Only update if text changed
    if (this.lastCounterText !== newText) {
      // ✅ FIXED: Check badge exists before updating (guard against DOM issues)
      const badge = document.getElementById('claude-nav-counter');
      if (badge) {
        // Use CounterBadge.update for consistency
        CounterBadge.updateById('claude-nav-counter', newText);
        this.lastCounterText = newText;
        this.log(`Counter badge güncellendi: ${newText}`);
      }
    }

    // Butonları enable/disable et
    this.updateButtonStates();
  }

  updateButtonStates() {
    const { prevBtn, nextBtn, topBtn } = this.elements;
    if (!prevBtn || !nextBtn || !topBtn) {
      this.log('❌ Butonlar bulunamadı, state güncellenemedi');
      return;
    }

    // ✅ FIXED: Always update button states based on current message count
    // Buttons are initialized disabled, enable them as messages are found
    const currentIdx = this.dom.getCurrentVisibleMessageIndex();

    const newStates = {
      prev: currentIdx === 0 || this.messages.length === 0,
      next: currentIdx === this.messages.length - 1 || this.messages.length === 0,
      top: this.messages.length === 0
    };

    this.log(`Button states: prev=${newStates.prev}, next=${newStates.next}, top=${newStates.top} (idx: ${currentIdx}, total: ${this.messages.length})`);

    // Only update if states changed
    if (newStates.prev !== this.lastButtonStates.prev) {
      prevBtn.disabled = newStates.prev;
      prevBtn.style.opacity = newStates.prev ? '0.3' : '1';
      prevBtn.style.cursor = newStates.prev ? 'not-allowed' : 'pointer';
      this.lastButtonStates.prev = newStates.prev;
      this.log(`Prev button ${newStates.prev ? 'disabled' : 'enabled'}`);
    }

    if (newStates.next !== this.lastButtonStates.next) {
      nextBtn.disabled = newStates.next;
      nextBtn.style.opacity = newStates.next ? '0.3' : '1';
      nextBtn.style.cursor = newStates.next ? 'not-allowed' : 'pointer';
      this.lastButtonStates.next = newStates.next;
      this.log(`Next button ${newStates.next ? 'disabled' : 'enabled'}`);
    }

    if (newStates.top !== this.lastButtonStates.top) {
      topBtn.disabled = newStates.top;
      topBtn.style.opacity = newStates.top ? '0.3' : '1';
      topBtn.style.cursor = newStates.top ? 'not-allowed' : 'pointer';
      this.lastButtonStates.top = newStates.top;
      this.log(`Top button ${newStates.top ? 'disabled' : 'enabled'}`);
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

  async onSettingsChanged(settings) {
    try {
      this.log('Settings güncellendi:', settings);

      // Only update position if it actually changed
      if (this.elements.container && settings.navigation) {
        try {
          const newPosition = settings.navigation.position || 'right';
          const currentLeft = this.elements.container.style.left;

          const shouldBeLeft = newPosition === 'left';
          const isCurrentlyLeft = currentLeft === '30px';

          if (shouldBeLeft !== isCurrentlyLeft) {
            this.elements.container.style.left = shouldBeLeft ? '30px' : 'auto';
            this.elements.container.style.right = shouldBeLeft ? 'auto' : '30px';
          }
        } catch (error) {
          this.error('Failed to update position:', error);
        }
      }

      // Only update opacity if it actually changed
      if (this.elements.container && settings.general && settings.general.opacity !== undefined) {
        try {
          const newOpacity = settings.general.opacity.toString();
          if (this.elements.container.style.opacity !== newOpacity) {
            this.cachedOpacity = settings.general.opacity; // Update cache
            this.elements.container.style.opacity = newOpacity;
          }
        } catch (error) {
          this.error('Failed to update opacity:', error);
        }
      }

      // Counter göster/gizle - only if changed
      const counter = document.getElementById('claude-nav-counter');
      if (counter && settings.navigation) {
        try {
          const shouldShow = settings.navigation.showCounter;
          const currentDisplay = counter.style.display;
          const targetDisplay = shouldShow ? 'block' : 'none';

          if (currentDisplay !== targetDisplay) {
            counter.style.display = targetDisplay;
          }
        } catch (error) {
          this.error('Failed to update counter visibility:', error);
        }
      }

      // Klavye kısayolları değişti mi?
      try {
        if (settings.navigation && settings.navigation.keyboardShortcuts !== await this.getSetting('keyboardShortcuts')) {
          if (settings.navigation.keyboardShortcuts) {
            this.setupKeyboardShortcuts();
          } else if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
          }
        }
      } catch (error) {
        this.error('Failed to update keyboard shortcuts:', error);
      }

      // Tema değişti mi? (general ayarlarından kontrol et)
      try {
        if (this.settings && this.settings.general) {
          this.recreateUI();
        }
      } catch (error) {
        this.error('Failed to recreate UI:', error);
      }
    } catch (error) {
      this.error('Error in onSettingsChanged:', error);
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
