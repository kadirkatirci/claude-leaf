import path from 'node:path';
import { resolveOrderedChatTargets } from '../../scripts/fixtures/lib/chatFixtureConfig.js';
import {
  clearPageErrors,
  ensureHarnessPage,
  expect,
  getPageErrors,
  navigateAndCollect,
  screenshotPath,
  test,
  tryGetExtensionState,
  writeLiveReport,
} from './support/liveTest.js';

function failedChecksMessage(result) {
  return result.evaluation.checks
    .filter(check => !check.pass)
    .map(check => `${check.id}: ${check.message}`)
    .join(' | ');
}

test.describe('live claude chat smoke', () => {
  test('authenticated Test profile can open the configured short, medium and long chat targets', async ({
    liveSession,
    livePage,
  }) => {
    const targets = await resolveOrderedChatTargets();
    const report = {
      generatedAt: new Date().toISOString(),
      artifactDir: liveSession.artifactDir,
      profileName: liveSession.cloneMetadata.profileName,
      profileDirectory: liveSession.cloneMetadata.profileDirectory,
      browserPath: liveSession.cloneMetadata.browserPath,
      targets: [],
    };

    for (const target of targets) {
      clearPageErrors(livePage);

      const result = await navigateAndCollect(livePage, 'chat', target.url, 7_000, target.smoke);
      result.targetName = target.targetName;
      result.pageErrors = getPageErrors(livePage);

      try {
        const harnessPage = await ensureHarnessPage(liveSession);
        result.extension = await tryGetExtensionState(harnessPage, result.pathname);
      } catch (error) {
        result.extension = {
          available: false,
          tabId: null,
          state: null,
          error: String(error),
        };
      }

      const screenshotName = `chat-${target.targetName}`;
      result.screenshot = path.basename(screenshotPath(liveSession.artifactDir, screenshotName));
      await livePage.screenshot({
        path: screenshotPath(liveSession.artifactDir, screenshotName),
        fullPage: false,
      });

      report.targets.push(result);

      expect(
        result.evaluation.pass,
        `Live ${target.targetName} chat failed: ${failedChecksMessage(result)}`
      ).toBe(true);
    }

    report.reportPath = await writeLiveReport(liveSession.artifactDir, report);
  });
});
