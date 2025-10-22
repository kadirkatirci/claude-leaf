/**
 * Claude Productivity Extension - Content Script Entry
 * Messaging-based loader
 */

(async () => {
  try {
    console.log('🎯 Claude Productivity Extension yükleniyor...');
    
    // URL kontrolü
    if (!window.location.hostname.includes('claude.ai')) {
      console.log('⏸️ Claude.ai olmayan bir sitede, extension pasif');
      return;
    }

    // Doğrudan import et (content script context'te)
    const { default: app } = await import('./App.js');
    await app.init();
    
    console.log('✅ Claude Productivity Extension hazır!');
    console.log('💡 İpucu: window.claudeProductivity ile extension\'a erişebilirsiniz');
    
  } catch (error) {
    console.error('❌ Claude Productivity Extension başlatılamadı:', error);
    console.error('Detay:', error.stack);
  }
})();
