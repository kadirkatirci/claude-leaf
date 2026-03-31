import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLiveCaptureHtml } from '../scripts/fixtures/lib/sanitizeLiveCapture.js';

test('sanitizeLiveCaptureHtml redacts message text, chat links and keeps edit/version structure', () => {
  const captureHtml = `
    <!doctype html>
    <html>
      <body>
        <div class="root">
          <div class="fixed">
            <nav aria-label="Sidebar">
              <h3>Recent</h3>
              <a href="/chat/original-chat-id">Sensitive title</a>
              <button aria-label="More options for Sensitive title" title="Sensitive title">...</button>
            </nav>
          </div>
          <div id="main-content">
            <button data-testid="chat-title-button">Sensitive title</button>
            <button data-testid="chat-menu-trigger" aria-label="More options for Sensitive title"></button>
            <div data-test-render-count="1">
              <div data-testid="user-message">
                <p>Private prompt content</p>
              </div>
              <div class="inline-flex items-center gap-1"><span>2 / 3</span></div>
              <button type="button" data-testid="action-bar-retry" aria-label="Retry">Retry</button>
            </div>
            <div data-test-render-count="2">
              <div class="standard-markdown">
                <h2>Private heading</h2>
                <p>Private assistant answer</p>
                <pre><code>const secret = true;</code></pre>
                <a href="https://example.com/private">private link</a>
              </div>
            </div>
            <div data-chat-input-container="true">
              <div contenteditable="true" role="textbox" data-testid="chat-input">typed draft</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const result = sanitizeLiveCaptureHtml({
    captureHtml,
    captureMeta: {
      colorScheme: 'dark',
      viewport: { width: 1440, height: 900 },
    },
    fixtureId: 'chat-real-medium',
    route: '/chat/fixture-real-medium',
    notes: 'Test fixture',
  });

  assert.equal(result.meta.sourceMode, 'sanitized_html');
  assert.equal(result.summary.messageCount, 2);
  assert.equal(result.summary.userMessageCount, 1);
  assert.equal(result.summary.editedMessageCount, 1);
  assert.match(result.sourceHtml, /Redacted user prompt 1/);
  assert.match(result.sourceHtml, /Redacted assistant detail 1\.2/);
  assert.match(result.sourceHtml, /Redacted heading 2\.1/);
  assert.match(result.sourceHtml, /redacted-link/);
  assert.match(result.sourceHtml, /2 \/ 3/);
  assert.match(result.sourceHtml, /action-bar-retry/);
  assert.match(result.sourceHtml, /Redacted conversation title/);
  assert.match(result.sourceHtml, /More options for redacted conversation/);
  assert.match(result.sourceHtml, /Redacted sidebar action/);
  assert.doesNotMatch(result.sourceHtml, /Private prompt content/);
  assert.doesNotMatch(result.sourceHtml, /Sensitive title/);
  assert.doesNotMatch(result.sourceHtml, /original-chat-id/);
});
