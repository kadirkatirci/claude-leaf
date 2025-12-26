/**
 * Module Loader - For ES modules
 * Runs in page context
 */

(async () => {
  try {
    // Get extension ID from script tag
    const currentScript = document.currentScript;
    const extensionId = currentScript?.dataset?.extensionId;

    if (!extensionId) {
      throw new Error('Extension ID not found');
    }

    const baseUrl = `chrome-extension://${extensionId}`;

    console.log('[Loader] Extension ID:', extensionId);
    console.log('[Loader] Base URL:', baseUrl);

    // Import App
    const { default: app } = await import(`${baseUrl}/src/App.js`);
    await app.init();

    console.log('✅ Claude Productivity Extension ready!');
    console.log('💡 Tip: Access the extension via window.claudeProductivity');
  } catch (error) {
    console.error('❌ Failed to load app:', error);
    console.error('Details:', error.stack);
  }
})();
