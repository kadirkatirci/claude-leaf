import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from './liveChrome.js';

export const LIVE_CHAT_TARGETS_PATH = path.join(repoRoot, '.auth', 'live-chat-targets.json');
export const CHAT_FIXTURE_MANIFEST_PATH = path.join(
  repoRoot,
  'scripts',
  'fixtures',
  'chat-fixtures.json'
);
export const DEFAULT_CHAT_TARGET_ORDER = ['short', 'medium', 'long'];

function normalizeChatUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    throw new Error('Chat target URL cannot be empty');
  }

  const url = candidate.startsWith('http')
    ? new URL(candidate)
    : new URL(candidate, 'https://claude.ai');

  if (url.origin !== 'https://claude.ai') {
    throw new Error(`Chat target must use https://claude.ai: ${candidate}`);
  }

  if (!url.pathname.startsWith('/chat/')) {
    throw new Error(`Chat target must point to /chat/...: ${candidate}`);
  }

  return url.toString();
}

export async function loadChatFixtureManifest() {
  const raw = await fs.readFile(CHAT_FIXTURE_MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);

  if (!manifest || typeof manifest !== 'object' || !manifest.targets) {
    throw new Error('scripts/fixtures/chat-fixtures.json must declare a "targets" object');
  }

  return manifest;
}

export async function loadLiveChatTargets(configPath = LIVE_CHAT_TARGETS_PATH) {
  let raw;
  try {
    raw = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        `Missing live chat target registry: ${configPath}. Create it from scripts/fixtures/live-chat-targets.example.json.`
      );
    }
    throw error;
  }

  const targets = JSON.parse(raw);
  if (!targets || typeof targets !== 'object') {
    throw new Error(`Live chat target registry must be a JSON object: ${configPath}`);
  }

  return targets;
}

export async function resolveChatTarget(targetName, options = {}) {
  const manifest = options.manifest || (await loadChatFixtureManifest());
  const liveTargets = options.liveTargets || (await loadLiveChatTargets(options.configPath));
  const targetMeta = manifest.targets?.[targetName];

  if (!targetMeta) {
    const knownTargets = Object.keys(manifest.targets || {}).sort();
    throw new Error(
      `Unknown chat target "${targetName}". Known targets: ${knownTargets.join(', ')}`
    );
  }

  const liveUrl = liveTargets[targetName];
  if (!liveUrl) {
    throw new Error(
      `Live chat target "${targetName}" is missing from ${options.configPath || LIVE_CHAT_TARGETS_PATH}`
    );
  }

  return {
    targetName,
    url: normalizeChatUrl(liveUrl),
    ...targetMeta,
  };
}

export async function resolveOrderedChatTargets(options = {}) {
  const manifest = options.manifest || (await loadChatFixtureManifest());
  const liveTargets = options.liveTargets || (await loadLiveChatTargets(options.configPath));
  const order = manifest.order || DEFAULT_CHAT_TARGET_ORDER;

  return Promise.all(
    order.map(targetName => {
      return resolveChatTarget(targetName, {
        ...options,
        manifest,
        liveTargets,
      });
    })
  );
}

export function summarizeKnownChatTargets(manifest) {
  return Object.keys(manifest?.targets || {}).sort();
}
