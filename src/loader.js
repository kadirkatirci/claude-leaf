/**
 * Module Loader - ES modules için
 * Page context'te çalışır
 */

(async () => {
  try {
    // Extension ID'yi script tag'inden al
    const currentScript = document.currentScript;
    const extensionId = currentScript?.dataset?.extensionId;
    
    if (!extensionId) {
      throw new Error('Extension ID bulunamadı');
    }
    
    const baseUrl = `chrome-extension://${extensionId}`;
    
    console.log('[Loader] Extension ID:', extensionId);
    console.log('[Loader] Base URL:', baseUrl);
    
    // App'i import et
    const { default: app } = await import(`${baseUrl}/src/App.js`);
    await app.init();
    
    console.log('✅ Claude Productivity Extension hazır!');
    console.log('💡 İpucu: window.claudeProductivity ile extension\'a erişebilirsiniz');
  } catch (error) {
    console.error('❌ App yüklenemedi:', error);
    console.error('Detay:', error.stack);
  }
})();
