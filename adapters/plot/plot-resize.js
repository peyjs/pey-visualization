// Resize watching for the Plot renderer: re-renders the chart when its
// container changes size. Guarded for environments without
// ResizeObserver; coalesces bursts with a frame callback.

/**
 * Watches one container's size changes.
 * @param {object} element Container element.
 * @param {Function} onResize Called (debounced per frame) on size changes.
 * @returns {Function|null} Release function, or null when unsupported.
 */
export function watchResize(element, onResize) {
  if (typeof globalThis.ResizeObserver !== 'function') {
    return null;
  }
  let scheduled = false;
  const observer = new globalThis.ResizeObserver(() => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      onResize();
    });
  });
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Schedules a callback for the next animation frame when available.
 * @param {Function} callback Callback.
 * @returns {void}
 */
function requestAnimationFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => callback());
  } else {
    callback();
  }
}
