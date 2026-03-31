import {
  DEFAULT_BROWSER_PATH,
  DEFAULT_CHROME_USER_DATA_DIR,
  DEFAULT_CLONE_DIR,
  DEFAULT_PROFILE_NAME,
  parseArgs,
  refreshChromeProfileClone,
} from './lib/liveChrome.js';

const args = parseArgs(process.argv);

const metadata = await refreshChromeProfileClone({
  profileName: args['profile-name'] || DEFAULT_PROFILE_NAME,
  chromeUserDataDir: args['chrome-user-data-dir'] || DEFAULT_CHROME_USER_DATA_DIR,
  cloneDir: args['clone-dir'] || DEFAULT_CLONE_DIR,
  browserPath: args['browser-path'] || DEFAULT_BROWSER_PATH,
});

console.log(`Refreshed Chrome profile clone for "${metadata.profileName}"`);
console.log(`  source: ${metadata.chromeUserDataDir}/${metadata.profileDirectory}`);
console.log(`  clone: ${metadata.cloneDir}`);
console.log(`  auth signals: ${metadata.authSignals.join(', ')}`);
