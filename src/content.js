/**
 * Claude Productivity Extension - Content Script Entry
 * Uses dynamic import for ES modules support in Chrome extensions
 */

(async () => {
  try {
    console.log('🎯 Claude Productivity Extension yükleniyor...');
    
    // URL kontrolü - sadece claude.ai'da çalış
    if (!window.location.hostname.includes('claude.ai')) {
      console.log('⏸️ Claude.ai olmayan bir sitede, extension pasif');
      return;
    }

    // Dynamic import ile App'i yükle
    const { default: app } = await import(chrome.runtime.getURL('src/App.js'));

    // Uygulamayı başlat
    await app.init();
    
    // Debugging için console'a bilgi ver
    console.log('💡 İpucu: window.claudeProductivity ile extension\'a erişebilirsiniz');
    console.log('💡 Örnek: window.claudeProductivity.getDebugInfo()');
    
  } catch (error) {
    console.error('❌ Claude Productivity Extension başlatılamadı:', error);
  }
})();
