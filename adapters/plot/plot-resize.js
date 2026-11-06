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
  let pendingFrame = null;
  const observer = new globalThis.ResizeObserver(() => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    pendingFrame = requestAnimationFrame(() => {
      scheduled = false;
      pendingFrame = null;
      onResize();
    });
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
    // A frame scheduled before release must not redraw a detached chart.
    cancelFrame(pendingFrame);
    pendingFrame = null;
  };
}

/**
 * Schedules a callback for the next animation frame when available.
 * @param {Function} callback Callback.
 * @returns {Function|number|null} Frame handle for cancellation, or null.
 */
function requestAnimationFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(() => callback());
  }
  callback();
  return null;
}

/**
 * Cancels a scheduled frame when the environment supports it.
 * @param {Function|number|null} handle Frame handle.
 * @returns {void}
 */
function cancelFrame(handle) {
  if (handle !== null && typeof globalThis.cancelAnimationFrame === 'function') {
    try {
      globalThis.cancelAnimationFrame(handle);
    } catch {
      // Cancelling an already-run frame is harmless.
    }
  }
}
