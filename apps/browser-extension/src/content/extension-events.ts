export function eventTargetsExtensionLayer(
  event: Pick<Event, 'target' | 'composedPath'>,
  rootHost: HTMLElement,
  overlayRoot: HTMLElement,
  popoverElement: HTMLElement
): boolean {
  if (typeof event.composedPath === 'function') {
    const path = event.composedPath();
    if (path.includes(rootHost) || path.includes(overlayRoot) || path.includes(popoverElement)) {
      return true;
    }
  }

  const target = event.target;
  return (
    target instanceof Node &&
    (popoverElement.contains(target) ||
      overlayRoot.contains(target) ||
      rootHost.contains(target))
  );
}
