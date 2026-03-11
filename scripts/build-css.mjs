import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const TARGETS = [
  {
    output: 'popup/popup.css',
    sources: [
      'popup/styles/foundation.css',
      'popup/styles/features.css',
      'popup/styles/settings.css',
      'popup/styles/chrome.css',
    ],
  },
  {
    output: 'styles.css',
    sources: ['src/styles/content-core.css'],
  },
];

async function buildTarget(target) {
  const sourceContents = await Promise.all(
    target.sources.map(sourcePath => readFile(path.join(ROOT, sourcePath), 'utf8'))
  );

  const outputContent = `${sourceContents.map(content => content.trimEnd()).join('\n\n')}\n`;
  await writeFile(path.join(ROOT, target.output), outputContent);
}

await Promise.all(TARGETS.map(buildTarget));
