/**
 * NavigationModule - Message navigation with buttons and counter
 */
import BaseModule from './BaseModule.js';
import { Events } from '../utils/EventBus.js';
import FixedButtonMixin from '../core/FixedButtonMixin.js';
import MessageObserverMixin from '../core/MessageObserverMixin.js';
import VisibilityManager from '../utils/VisibilityManager.js';
import Button from '../components/primitives/Button.js';
import CounterBadge from '../components/primitives/CounterBadge.js';
import IconLibrary from '../components/primitives/IconLibrary.js';
import tokens from '../components/theme/tokens.js';
import { panelManager } from '../components/PanelManager.js'; // Shared panel
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';
import { scheduleVisualUpdate } from '../utils/AnimationScheduler.js';

const NAV_CONFIG = MODULE_CONSTANTS.navigation;

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

    // Navigation state management - prevents scroll tracking conflicts
    this.isNavigating = false; // Lock scroll tracking during button navigation
    this.scrollDebounceTimer = null; // Debounce timer for manual scroll updates
    this.navigationLockTimer = null; // Timer to unlock navigation after scroll completes

    // Intersection Observer for efficient scroll tracking
    this.intersectionObserver = null; // Observer for visible message detection
    this.observedMessages = new WeakMap(); // Track which messages are being observed
  }

  async init() {
    await super.init();
    if (!this.enabled) return;

    try {
      this.log('Navigation başlatılıyor...');

      // Enhance with mixins
      FixedButtonMixin.enhance(this);
      MessageObserverMixin.enhance(this);

      // Create UI (buttons + panel)
      await this.createUI();

      // Setup visibility listener (from mixin)
      this.setupVisibilityListener();

      // Setup message observer with 500ms throttle (optimized from 300ms)
      this.setupMessageObserver(() => {
        const messages = this.dom.findMessages();
        this.messages = messages;
        this.updateCounter();
        this.emit(Events.MESSAGES_UPDATED, messages);

        // Re-setup intersection observer when messages change
        this.setupIntersectionObserver();
      }, {
        throttleDelay: 500,
        trackMessageCount: true,
        checkConversationPage: false
      });

      // Initial counter update
      const initialMessages = this.dom.findMessages();
      this.updateCounter(initialMessages.length);

      // Setup keyboard shortcuts if enabled
      if (NAV_CONFIG.keyboardShortcuts) {
        this.setupKeyboardShortcuts();
      }

      // Setup Intersection Observer for efficient scroll tracking
      this.setupIntersectionObserver();

      this.log('✅ Navigation aktif');
    } catch (error) {
      this.error('Navigation initialization failed:', error);
      throw error;
    }
  }

  /**
   * Handle visibility change from VisibilityManager
   * Now uses standard FixedButtonMixin pattern
   */
  handleVisibilityChange(isConversationPage) {
    this.lastConversationState = isConversationPage;

    if (this.elements.container) {
      VisibilityManager.setElementVisibility(this.elements.container, isConversationPage);
    }

    if (!isConversationPage) {
      this.log('📵 Page changed to non-conversation');
      // Just clear internal state, don't hide container explicitly (PanelManager does it)
      this.clearUIElements();
    } else {
      this.log('💬 Page changed to conversation, showing navigation');
      // Use standard updateUI pattern - immediate update
      this.updateUI();
      // Also use retry mechanism for messages that haven't loaded yet
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

  /**
   * Update all UI components (standard pattern for FixedButtonMixin)
   */
  async updateUI() {
    // Don't update if not on conversation page
    if (!this.lastConversationState) return;

    this.log('Updating navigation UI');

    // Find messages
    const oldLength = this.messages.length;
    this.messages = this.dom.findMessages();

    // Update counter immediately
    this.updateCounter();

    // Also check scroll position to update currentIndex
    if (this.messages.length > 0) {
      const scrollIndex = this.dom.getCurrentVisibleMessageIndex(this.messages);
      if (scrollIndex !== this.currentIndex && scrollIndex >= 0) {
        this.currentIndex = scrollIndex;
        this.updateCounter();
      }
    }

    // Update button states
    this.updateButtonStates();

    // Emit event if message count changed
    if (this.messages.length !== oldLength) {
      this.emit(Events.MESSAGES_UPDATED, this.messages);
    }

    // Mark initial load as complete if we found messages
    if (!this.hasInitialLoadCompleted && this.messages.length > 0) {
      this.hasInitialLoadCompleted = true;
      this.log(`✅ Initial UI update: ${this.messages.length} messages`);
    }
  }

  /**
   * Clear UI elements on page change (standard pattern for FixedButtonMixin)
   */
  clearUIElements() {
    this.log('Clearing navigation UI elements');

    // Reset all state
    this.messages = [];
    this.lastMessageCount = 0;
    this.currentIndex = -1;
    this.hasInitialLoadCompleted = false;

    // Stop scroll tracking to avoid updating when messages aren't visible
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }

    // Update counter to show 0/0
    this.updateCounter();

    // Disable buttons
    this.updateButtonStates();
  }

  destroy() {
    // Clear navigation timers
    if (this.navigationLockTimer) {
      clearTimeout(this.navigationLockTimer);
      this.navigationLockTimer = null;
    }

    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }

    // Disconnect Intersection Observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    // Unsubscribe from visibility changes
    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
    }

    // Destroy message observer
    if (this.destroyMessageObserver && typeof this.destroyMessageObserver === 'function') {
      this.destroyMessageObserver();
    }

    super.destroy();
  }

  async createUI() {
    this.cachedOpacity = NAV_CONFIG.opacity;

    // Use PanelManager to get/create container
    // PanelManager handles visibility and creation logic
    // We just register our buttons

    // Top button
    const topBtn = this.createButton(IconLibrary.arrowUpDouble('currentColor', 20), 'En üste git (Alt+Home)', () => this.navigateToTop());
    topBtn.id = 'claude-nav-top';
    topBtn.disabled = true;
    topBtn.style.opacity = '0.3';
    topBtn.style.cursor = 'not-allowed';
    panelManager.addButton(topBtn, 10); // Order 10

    // Previous button
    const prevBtn = this.createButton(IconLibrary.arrowUp('currentColor', 20), 'Önceki mesaj (Alt+↑)', () => this.navigatePrevious());
    prevBtn.id = 'claude-nav-prev';
    prevBtn.disabled = true;
    prevBtn.style.opacity = '0.3';
    prevBtn.style.cursor = 'not-allowed';
    panelManager.addButton(prevBtn, 20); // Order 20

    // Next button
    const nextBtn = this.createButton(IconLibrary.arrowDown('currentColor', 20), 'Sonraki mesaj (Alt+↓)', () => this.navigateNext());
    nextBtn.id = 'claude-nav-next';
    nextBtn.disabled = true;
    nextBtn.style.opacity = '0.3';
    nextBtn.style.cursor = 'not-allowed';
    panelManager.addButton(nextBtn, 30); // Order 30

    // Counter badge attachment (logic remains same)
    if (NAV_CONFIG.showCounter) {
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

    // Keep reference for visibility management mixin (if used)
    // But mostly handled by PanelManager now
    this.elements.container = document.getElementById('claude-nav-container');
    this.elements.topBtn = topBtn;
    this.elements.prevBtn = prevBtn;
    this.elements.nextBtn = nextBtn;
  } // End of createUI


  createButton(icon, tooltip, onClick) {
    // Use Button component for consistent styling (size-9 = 36px from theme.buttonClasses)
    return Button.create({
      variant: 'fixed',
      icon: icon,
      title: tooltip,
      onClick: onClick,
      className: 'claude-nav-btn',
      style: {
        position: 'relative'
      }
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

  /**
   * Lock scroll tracking during button navigation
   * Prevents scroll detection from overwriting navigation state
   */
  lockScrollTracking() {
    this.isNavigating = true;

    // Clear any existing lock timer
    if (this.navigationLockTimer) {
      clearTimeout(this.navigationLockTimer);
    }

    // Unlock after 1 second (enough for smooth scroll to complete)
    this.navigationLockTimer = setTimeout(() => {
      this.isNavigating = false;
      this.log('🔓 Scroll tracking unlocked');
    }, 1000);

    this.log('🔒 Scroll tracking locked for navigation');
  }

  navigatePrevious() {
    if (this.messages.length === 0) return;

    // Ensure currentIndex is initialized if not set
    if (this.currentIndex < 0) {
      this.currentIndex = this.dom.getCurrentVisibleMessageIndex(this.messages);
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.lockScrollTracking(); // Lock scroll detection during navigation
      this.scrollToMessage(this.currentIndex);
      this.emit(Events.NAVIGATION_PREV, this.currentIndex);
    }
  }

  navigateNext() {
    if (this.messages.length === 0) return;

    // Ensure currentIndex is initialized if not set
    if (this.currentIndex < 0) {
      this.currentIndex = this.dom.getCurrentVisibleMessageIndex(this.messages);
    }

    if (this.currentIndex < this.messages.length - 1) {
      this.currentIndex++;
      this.lockScrollTracking(); // Lock scroll detection during navigation
      this.scrollToMessage(this.currentIndex);
      this.emit(Events.NAVIGATION_NEXT, this.currentIndex);
    }
  }

  navigateToTop() {
    if (this.messages.length === 0) return;

    this.currentIndex = 0;
    this.lockScrollTracking(); // Lock scroll detection during navigation
    this.scrollToMessage(0);
    this.emit(Events.NAVIGATION_TOP, 0);
  }

  async scrollToMessage(index) {
    if (index < 0 || index >= this.messages.length) return;

    const message = this.messages[index];

    // Update currentIndex when navigating programmatically
    this.currentIndex = index;

    // Add temporary scroll-margin to create top spacing
    const originalMargin = message.style.scrollMarginTop;
    message.style.scrollMarginTop = '20px';

    // Scroll to message
    const smoothScroll = NAV_CONFIG.smoothScroll;

    if (smoothScroll) {
      this.dom.scrollToElement(message, 'start');
    } else {
      message.scrollIntoView({ block: 'start' });
    }

    // Restore original margin after scroll
    setTimeout(() => {
      message.style.scrollMarginTop = originalMargin;
    }, smoothScroll ? 500 : 100);

    // Highlight
    const duration = NAV_CONFIG.highlightDuration;
    this.dom.flashClass(message, 'claude-nav-highlight', duration);

    this.updateCounter();
    this.emit(Events.MESSAGE_SCROLLED, { index, message });

    this.log(`Mesaj ${index + 1}/${this.messages.length} gösteriliyor (currentIndex: ${this.currentIndex})`);
  }

  updateCounter() {
    let newText;
    if (this.messages.length > 0) {
      // ALWAYS use cached index - no recalculation
      // Clamp index to valid range
      const safeIndex = Math.max(0, Math.min(this.currentIndex, this.messages.length - 1));
      const current = safeIndex + 1;

      newText = `${current}/${this.messages.length}`;
      this.log(`Counter güncelleniyor: ${newText} (index: ${this.currentIndex})`);
    } else {
      newText = '0/0';
      this.currentIndex = -1; // Reset index when no messages
    }

    // Only update if text changed
    if (this.lastCounterText !== newText) {
      const badge = document.getElementById('claude-nav-counter');
      if (badge) {
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

    // ALWAYS use cached index - no recalculation
    // Clamp to valid range
    const currentIdx = Math.max(0, Math.min(this.currentIndex, this.messages.length - 1));

    const newStates = {
      prev: currentIdx === 0 || this.messages.length === 0,
      next: currentIdx === this.messages.length - 1 || this.messages.length === 0,
      top: this.messages.length === 0
    };

    this.log(`Button states: prev=${newStates.prev}, next=${newStates.next}, top=${newStates.top} (idx: ${this.currentIndex}, total: ${this.messages.length})`);

    // Batch style updates to minimize reflows
    // Use requestAnimationFrame for smooth 60fps updates
    // Only update if states changed
    if (newStates.prev !== this.lastButtonStates.prev) {
      const shouldDisable = newStates.prev;
      prevBtn.disabled = shouldDisable;
      scheduleVisualUpdate(() => {
        Object.assign(prevBtn.style, {
          opacity: shouldDisable ? '0.3' : '1',
          cursor: shouldDisable ? 'not-allowed' : 'pointer'
        });
      }, 'nav-prev-btn');
      this.lastButtonStates.prev = shouldDisable;
      this.log(`Prev button ${shouldDisable ? 'disabled' : 'enabled'}`);
    }

    if (newStates.next !== this.lastButtonStates.next) {
      const shouldDisable = newStates.next;
      nextBtn.disabled = shouldDisable;
      scheduleVisualUpdate(() => {
        Object.assign(nextBtn.style, {
          opacity: shouldDisable ? '0.3' : '1',
          cursor: shouldDisable ? 'not-allowed' : 'pointer'
        });
      }, 'nav-next-btn');
      this.lastButtonStates.next = shouldDisable;
      this.log(`Next button ${shouldDisable ? 'disabled' : 'enabled'}`);
    }

    if (newStates.top !== this.lastButtonStates.top) {
      const shouldDisable = newStates.top;
      topBtn.disabled = shouldDisable;
      scheduleVisualUpdate(() => {
        Object.assign(topBtn.style, {
          opacity: shouldDisable ? '0.3' : '1',
          cursor: shouldDisable ? 'not-allowed' : 'pointer'
        });
      }, 'nav-top-btn');
      this.lastButtonStates.top = shouldDisable;
      this.log(`Top button ${shouldDisable ? 'disabled' : 'enabled'}`);
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

  /**
   * Setup Intersection Observer for efficient scroll tracking
   * Replaces old scroll listener with modern, performant approach
   */
  setupIntersectionObserver() {
    // Cleanup existing observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    // Don't setup if no messages
    if (!this.messages || this.messages.length === 0) {
      return;
    }

    this.log('👁️ Setting up Intersection Observer for scroll tracking...');

    // Track which message is most visible
    let mostVisibleMessage = null;
    let maxVisibility = 0;

    // Create observer with 50% threshold for better accuracy
    this.intersectionObserver = new IntersectionObserver((entries) => {
      // Ignore during button navigation
      if (this.isNavigating) {
        return;
      }

      // Reset tracking
      mostVisibleMessage = null;
      maxVisibility = 0;

      // Find most visible message
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > maxVisibility) {
          maxVisibility = entry.intersectionRatio;
          mostVisibleMessage = entry.target;
        }
      });

      // Update current index if we have a visible message
      if (mostVisibleMessage) {
        const newIndex = this.messages.indexOf(mostVisibleMessage);

        if (newIndex !== -1 && newIndex !== this.currentIndex) {
          this.log(`👁️ Intersection update: ${this.currentIndex} → ${newIndex} (visibility: ${(maxVisibility * 100).toFixed(0)}%)`);
          this.currentIndex = newIndex;
          this.updateCounter();
        }
      }
    }, {
      root: null, // viewport
      threshold: [0, 0.25, 0.5, 0.75, 1.0], // Multiple thresholds for accuracy
      rootMargin: '-10% 0px -10% 0px' // Ignore top/bottom 10% of viewport
    });

    // Observe all messages
    this.messages.forEach(message => {
      this.intersectionObserver.observe(message);
      this.observedMessages.set(message, true);
    });

    this.log(`👁️ Intersection Observer setup complete (${this.messages.length} messages)`);

    // Add cleanup
    this.unsubscribers.push(() => {
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
        this.log('👁️ Intersection Observer disconnected');
      }
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
        if (settings.navigation && settings.navigation.keyboardShortcuts !== NAV_CONFIG.keyboardShortcuts) {
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

  /**
   * Enable or disable scroll debugging (can be called from console)
   * Usage: window.claudeProductivity.getModule('navigation').setScrollDebug(true)
   * @param {boolean} enable - Enable or disable debug logging
   */
  setScrollDebug(enable) {
    this.debugScroll = enable;
    console.log(`NavigationModule scroll debugging ${enable ? 'enabled' : 'disabled'}`);

    if (enable) {
      console.log('Scroll debug info will be logged. Watch for [NAV SCROLL DEBUG] messages.');
      console.log(`Current state: ${this.messages.length} messages, index: ${this.currentIndex}`);
    }
  }
}

export default NavigationModule;
