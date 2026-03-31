function finishStreamingAfterBoot() {
  const finish = () => {
    if (!window.__claudeFixture?.finishStreaming) {
      return;
    }
    window.setTimeout(() => {
      window.__claudeFixture.finishStreaming(6);
    }, 250);
  };

  if (window.__claudeFixture) {
    finish();
  } else {
    document.addEventListener(
      'claude-fixture:ready',
      () => {
        finish();
      },
      { once: true }
    );
  }
}

if (document.readyState === 'complete') {
  finishStreamingAfterBoot();
} else {
  window.addEventListener('load', finishStreamingAfterBoot, { once: true });
}
