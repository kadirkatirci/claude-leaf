import resolve from '@rollup/plugin-node-resolve';
import { writeFileSync } from 'fs';
import { DEV_CONFIG } from './src/config/DevConfig.js';

// Generate popup devConfig.json from DevConfig.js (single source of truth)
function generatePopupDevConfig() {
  return {
    name: 'generate-popup-dev-config',
    buildStart() {
      const disabledModules = Object.entries(DEV_CONFIG.modules)
        .filter(([_, config]) => config.DEV_DISABLED === true)
        .map(([name]) => name);

      const popupConfig = { disabledModules };

      writeFileSync(
        './popup/devConfig.json',
        JSON.stringify(popupConfig, null, 2) + '\n'
      );

      if (disabledModules.length > 0) {
        console.log(`🚧 Dev-disabled modules: ${disabledModules.join(', ')}`);
      }
    }
  };
}

export default {
  input: 'src/content.js',
  output: {
    file: 'dist/content.bundle.js',
    format: 'iife',
    name: 'ClaudeProductivity',
    inlineDynamicImports: true
  },
  plugins: [
    generatePopupDevConfig(),
    resolve()
  ]
};
