// The empty state: no data is not an error — the chart shows a quiet
// placeholder instead of a drawing.

const EMPTY_MESSAGE = 'داده‌ای برای نمایش نیست';

/**
 * Renders the empty state into the container.
 * @param {object} container Container element.
 * @param {object} style Wrapper styles ({ direction, fontFamily, fontSize }).
 * @returns {void}
 */
export function renderEmptyState(container, style) {
  const box = globalThis.document.createElement('div');
  box.className = 'pey-vis-empty';
  box.textContent = EMPTY_MESSAGE;
  applyWrapperStyle(box, style);
  Object.assign(box.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '120px',
    opacity: '0.55',
  });
  container.append(box);
}

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
 * Renders the chart title and caption as plain HTML above/below the plot —
 * full font and direction control stays with the wrapper.
 * @param {object} container Container element.
 * @param {object} spec Chart spec (title?, caption?).
 * @param {object} style Wrapper styles.
 * @returns {void}
 */
export function renderTitleElements(container, spec, style) {
  if (spec.title) {
    const heading = globalThis.document.createElement('div');
    heading.className = 'pey-vis-title';
    heading.textContent = spec.title;
    applyWrapperStyle(heading, style);
    heading.style.fontWeight = 'bold';
    heading.style.marginBottom = '4px';
    container.append(heading);
  }
  if (spec.caption) {
    const caption = globalThis.document.createElement('div');
    caption.className = 'pey-vis-caption';
    caption.textContent = spec.caption;
    applyWrapperStyle(caption, style);
    caption.style.marginTop = '4px';
    caption.style.opacity = '0.75';
    container.append(caption);
  }
}
