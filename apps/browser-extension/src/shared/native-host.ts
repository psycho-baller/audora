import { browser } from './browser';
import type { BackgroundMessage } from './types';

export const AUDORA_NATIVE_HOST = 'studio.orbitlabs.audora.writing';

export async function sendNativeHostMessage<T>(message: BackgroundMessage): Promise<T | null> {
  try {
    return (await browser.runtime.sendNativeMessage(AUDORA_NATIVE_HOST, message)) as T;
  } catch {
    return null;
  }
}

