import type { BackgroundMessage, BootstrapPayload } from './types';
import { browser } from './browser';

export async function sendBackgroundMessage<T>(message: BackgroundMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

export async function loadBootstrap(site = ''): Promise<BootstrapPayload> {
  return sendBackgroundMessage<BootstrapPayload>({
    type: 'awareness:get-bootstrap',
    site,
  });
}
