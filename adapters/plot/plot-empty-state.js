// Wrapper elements the Plot renderer composes around the drawing: the
// empty state (no data is not an error), the title and the caption —
// plain HTML so font and direction control stay with the wrapper.

const EMPTY_MESSAGE = 'داده‌ای برای نمایش نیست';

/**
 * Applies the wrapper styles to any element the renderer creates.
 * @param {object} element Target element.
 * @param {object} style Wrapper styles.
 * @returns {void}
 */
export function applyWrapperStyle(element, style) {
  element.dir = style.direction;
  if (style.fontFamily) {
    element.style.fontFamily = style.fontFamily;
  }
  if (style.fontSize) {
    element.style.fontSize = `${style.fontSize}px`;
  }
}

/**
 * Renders the empty state into the container.
 * @param {object} container Container element.
 * @param {object} style Wrapper styles.
 * @returns {void}
 */
export function renderEmptyState(container, style) {
  const box = globalThis.document.createElement('div');
  box.className = 'pey-vis-empty';
  box.textContent = EMPTY_MESSAGE;
  applyWrapperStyle(box, style);
  box.style.display = 'flex';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.minHeight = '120px';
  box.style.opacity = '0.55';
  container.append(box);
}

/**
 * Renders the chart title above the drawing.
 * @param {object} container Container element.
 * @param {object} spec Chart spec (title?).
 * @param {object} style Wrapper styles.
 * @returns {void}
 */
export function renderTitle(container, spec, style) {
  if (!spec.title) {
    return;
  }
  const heading = globalThis.document.createElement('div');
  heading.className = 'pey-vis-title';
  heading.textContent = spec.title;
  applyWrapperStyle(heading, style);
  heading.style.fontWeight = 'bold';
  heading.style.marginBottom = '4px';
  container.append(heading);
}

/**
 * Renders the chart caption below the drawing.
 * @param {object} container Container element.
 * @param {object} spec Chart spec (caption?).
 * @param {object} style Wrapper styles.
 * @returns {void}
 */
export function renderCaption(container, spec, style) {
  if (!spec.caption) {
    return;
  }
  const caption = globalThis.document.createElement('div');
  caption.className = 'pey-vis-caption';
  caption.textContent = spec.caption;
  applyWrapperStyle(caption, style);
  caption.style.marginTop = '4px';
  caption.style.opacity = '0.75';
  container.append(caption);
}
