import { InlineWritingController } from './inline-controller';

const ACTIVE_ATTRIBUTE = 'data-eloq-inline-writing-active';

declare global {
  interface Window {
    __eloqInlineWritingController?: InlineWritingController;
  }
}

if (
  document.documentElement?.getAttribute(ACTIVE_ATTRIBUTE) === 'true' &&
  document.querySelector('div[data-audora-writing-root="true"]')
) {
  // Another injected instance already owns the page overlay.
} else {
  document.documentElement?.setAttribute(ACTIVE_ATTRIBUTE, 'true');
  window.__eloqInlineWritingController?.dispose();
  document
    .querySelectorAll('div[data-audora-writing-root="true"]')
    .forEach((node) => node.remove());

  const controller = new InlineWritingController();
  window.__eloqInlineWritingController = controller;

  void controller.start().catch(() => {
    document.documentElement?.removeAttribute(ACTIVE_ATTRIBUTE);
  });
}
