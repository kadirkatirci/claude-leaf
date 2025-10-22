import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/content.js',
  output: {
    file: 'dist/content.bundle.js',
    format: 'iife',
    name: 'ClaudeProductivity',
    inlineDynamicImports: true  // Burada olmalı!
  },
  plugins: [
    resolve()
  ]
};
