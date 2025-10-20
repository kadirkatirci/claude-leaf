// Claude Productivity Extension - Navigation Buttons
// Author: Kadir
// Feature: Quick navigation between Q&A pairs

class ClaudeNavigator {
  constructor() {
    this.messages = [];
    this.currentIndex = -1;
    this.buttonsContainer = null;
    this.observer = null;
    
    this.init();
  }

  init() {
    console.log('🚀 Claude Productivity Extension - Navigation başlatıldı');
    
    // Sayfa yüklenmesini bekle
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    // Navigation buttonları oluştur
    this.createNavigationButtons();
    
    // Mesajları bul ve izlemeye başla
    this.findMessages();
    this.observeMessages();
    
    // Klavye kısayolları
    this.setupKeyboardShortcuts();
    
    console.log(`✅ ${this.messages.length} mesaj bulundu`);
  }

  createNavigationButtons() {
    // Eğer zaten varsa tekrar oluşturma
    if (document.getElementById('claude-nav-buttons')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'claude-nav-buttons';
    container.className = 'claude-nav-buttons';

    // Previous button (Yukarı)
    const prevBtn = document.createElement('button');
    prevBtn.className = 'claude-nav-btn';
    prevBtn.id = 'claude-nav-prev';
    prevBtn.innerHTML = '↑';
    prevBtn.setAttribute('data-tooltip', 'Önceki mesaj (Alt+↑)');
    prevBtn.addEventListener('click', () => this.navigatePrevious());

    // Next button (Aşağı)
    const nextBtn = document.createElement('button');
    nextBtn.className = 'claude-nav-btn';
    nextBtn.id = 'claude-nav-next';
    nextBtn.innerHTML = '↓';
    nextBtn.setAttribute('data-tooltip', 'Sonraki mesaj (Alt+↓)');
    nextBtn.addEventListener('click', () => this.navigateNext());

    // Top button (En üst)
    const topBtn = document.createElement('button');
    topBtn.className = 'claude-nav-btn';
    topBtn.id = 'claude-nav-top';
    topBtn.innerHTML = '⇈';
    topBtn.setAttribute('data-tooltip', 'En üste git (Alt+Home)');
    topBtn.addEventListener('click', () => this.navigateToTop());

    // Counter badge
    const counterBadge = document.createElement('div');
    counterBadge.className = 'claude-nav-counter';
    counterBadge.id = 'claude-nav-counter';
    counterBadge.textContent = '0/0';
    prevBtn.appendChild(counterBadge);

    container.appendChild(topBtn);
    container.appendChild(prevBtn);
    container.appendChild(nextBtn);

    document.body.appendChild(container);
    this.buttonsContainer = container;

    console.log('✅ Navigation butonları oluşturuldu');
  }

  findMessages() {
    // Claude'un mesaj yapısını bul
    // Claude.ai'da mesajlar genelde belirli class'lar ile işaretlenir
    // Bu selector'ları Claude'un DOM yapısına göre ayarlamak gerekebilir
    
    const possibleSelectors = [
      '[data-test-render-count]', // Claude mesaj container'ı
      '.font-claude-message',
      '[class*="Message"]',
      '[role="article"]'
    ];

    this.messages = [];

    for (const selector of possibleSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        this.messages = Array.from(elements);
        console.log(`📝 ${this.messages.length} mesaj bulundu (selector: ${selector})`);
        break;
      }
    }

    // Eğer hiç mesaj bulunamadıysa, daha genel bir yaklaşım
    if (this.messages.length === 0) {
      // Ana chat container'ı bul
      const chatContainer = document.querySelector('main') || document.querySelector('[role="main"]');
      if (chatContainer) {
        // İçindeki tüm büyük blokları mesaj olarak kabul et
        const allDivs = chatContainer.querySelectorAll('div');
        this.messages = Array.from(allDivs).filter(div => {
          // En az 100px yüksekliğinde olan divler muhtemelen mesajdır
          return div.offsetHeight > 100 && div.textContent.trim().length > 50;
        });
        console.log(`📝 ${this.messages.length} mesaj tahmini yapıldı`);
      }
    }

    this.updateCounter();
  }

  observeMessages() {
    // DOM değişikliklerini izle (yeni mesajlar için)
    const targetNode = document.querySelector('main') || document.body;
    
    const config = {
      childList: true,
      subtree: true
    };

    this.observer = new MutationObserver((mutations) => {
      // Debounce için timeout
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        const oldLength = this.messages.length;
        this.findMessages();
        if (this.messages.length !== oldLength) {
          console.log(`🔄 Mesaj sayısı güncellendi: ${oldLength} → ${this.messages.length}`);
        }
      }, 500);
    });

    this.observer.observe(targetNode, config);
  }

  getCurrentMessageIndex() {
    // Şu anda görünen mesajı bul
    const scrollPosition = window.scrollY + window.innerHeight / 2;
    
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      const rect = msg.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const elementBottom = elementTop + rect.height;
      
      if (scrollPosition >= elementTop && scrollPosition <= elementBottom) {
        return i;
      }
    }
    
    // Eğer tam bir mesaj bulunamazsa en yakını
    let closest = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      const rect = msg.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const distance = Math.abs(scrollPosition - elementTop);
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = i;
      }
    }
    
    return closest;
  }

  navigatePrevious() {
    if (this.messages.length === 0) {
      console.log('⚠️ Henüz mesaj bulunamadı');
      return;
    }

    this.currentIndex = this.getCurrentMessageIndex();
    
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.scrollToMessage(this.currentIndex);
    } else {
      console.log('ℹ️ Zaten en üstteki mesajdasınız');
    }
  }

  navigateNext() {
    if (this.messages.length === 0) {
      console.log('⚠️ Henüz mesaj bulunamadı');
      return;
    }

    this.currentIndex = this.getCurrentMessageIndex();
    
    if (this.currentIndex < this.messages.length - 1) {
      this.currentIndex++;
      this.scrollToMessage(this.currentIndex);
    } else {
      console.log('ℹ️ Zaten en alttaki mesajdasınız');
    }
  }

  navigateToTop() {
    if (this.messages.length === 0) {
      console.log('⚠️ Henüz mesaj bulunamadı');
      return;
    }

    this.currentIndex = 0;
    this.scrollToMessage(0);
  }

  scrollToMessage(index) {
    if (index < 0 || index >= this.messages.length) {
      return;
    }

    const message = this.messages[index];
    
    // Smooth scroll
    message.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    // Mesajı vurgula
    this.highlightMessage(message);
    
    // Counter'ı güncelle
    this.updateCounter();

    console.log(`📍 Mesaj ${index + 1}/${this.messages.length} gösteriliyor`);
  }

  highlightMessage(message) {
    // Önceki vurguyu kaldır
    document.querySelectorAll('.claude-nav-highlight').forEach(el => {
      el.classList.remove('claude-nav-highlight');
    });

    // Yeni vurgu ekle
    message.classList.add('claude-nav-highlight');
    
    // Vurguyu 2 saniye sonra kaldır
    setTimeout(() => {
      message.classList.remove('claude-nav-highlight');
    }, 2000);
  }

  updateCounter() {
    const counter = document.getElementById('claude-nav-counter');
    if (counter && this.messages.length > 0) {
      const current = this.getCurrentMessageIndex() + 1;
      counter.textContent = `${current}/${this.messages.length}`;
    } else if (counter) {
      counter.textContent = '0/0';
    }

    // Butonları enable/disable et
    const prevBtn = document.getElementById('claude-nav-prev');
    const nextBtn = document.getElementById('claude-nav-next');
    const topBtn = document.getElementById('claude-nav-top');

    if (prevBtn && nextBtn && topBtn) {
      const currentIdx = this.getCurrentMessageIndex();
      prevBtn.disabled = currentIdx === 0 || this.messages.length === 0;
      nextBtn.disabled = currentIdx === this.messages.length - 1 || this.messages.length === 0;
      topBtn.disabled = this.messages.length === 0;
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Alt + Arrow Up: Önceki mesaj
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigatePrevious();
      }
      
      // Alt + Arrow Down: Sonraki mesaj
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateNext();
      }
      
      // Alt + Home: En üste git
      if (e.altKey && e.key === 'Home') {
        e.preventDefault();
        this.navigateToTop();
      }
    });

    // Scroll olduğunda counter'ı güncelle
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.updateCounter();
      }, 100);
    });

    console.log('⌨️ Klavye kısayolları aktif: Alt+↑/↓, Alt+Home');
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.buttonsContainer) {
      this.buttonsContainer.remove();
    }
  }
}

// Extension'ı başlat
const navigator = new ClaudeNavigator();

// CSS highlight animasyonu için stil ekle
const style = document.createElement('style');
style.textContent = `
  .claude-nav-highlight {
    animation: claude-highlight-pulse 0.5s ease-in-out;
    outline: 3px solid #667eea !important;
    outline-offset: 4px;
    border-radius: 8px;
  }
  
  @keyframes claude-highlight-pulse {
    0%, 100% { outline-color: #667eea; }
    50% { outline-color: #764ba2; }
  }
`;
document.head.appendChild(style);
