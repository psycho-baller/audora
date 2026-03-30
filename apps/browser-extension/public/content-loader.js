(function () {
  const runtime =
    globalThis.browser?.runtime ??
    globalThis.chrome?.runtime ??
    null;

  if (!runtime?.getURL) {
    return;
  }

  import(runtime.getURL('content.js'))
    .then(() => undefined)
    .catch((error) => {
      console.error('[Eloq] Failed to load content runtime.', error);
    });
})();
