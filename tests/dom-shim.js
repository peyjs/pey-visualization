// A minimal DOM shim for headless renderer tests: elements track children
// and attributes, the Plot SVG builds through createElementNS, and the
// container/report surface mirrors what the renderer touches. No layout.

/**
 * Builds one shim element.
 * @param {object} document Owner document shim.
 * @param {string} tagName Element tag.
 * @param {string} [ns] Namespace when created via createElementNS.
 * @returns {object} Element.
 */
function makeElement(document, tagName, ns = null) {
  const element = {
    tagName,
    namespaceURI: ns,
    children: [],
    parentNode: null,
    attributes: {},
    dataset: {},
    style: { setProperty: () => {} },
    className: '',
    dir: '',
    clientWidth: 800,
    ownerDocument: document,
    listeners: {},
    append(...kids) {
      for (const kid of kids) {
        element.children.push(kid);
        kid.parentNode = element;
      }
    },
    appendChild(kid) {
      element.children.push(kid);
      kid.parentNode = element;
      return kid;
    },
    replaceChildren(...kids) {
      element.children = [];
      element.append(...kids);
    },
    insertBefore(kid, reference) {
      const index = reference === null || reference === undefined
        ? element.children.length
        : element.children.indexOf(reference);
      if (index === -1) {
        element.children.push(kid);
      } else {
        element.children.splice(index, 0, kid);
      }
      kid.parentNode = element;
      return kid;
    },
    setAttribute(name, value) {
      element.attributes[name] = value;
    },
    getAttribute(name) {
      return element.attributes[name] ?? null;
    },
    removeAttribute(name) {
      delete element.attributes[name];
    },
    remove() {
      if (element.parentNode !== null) {
        const siblings = element.parentNode.children;
        const index = siblings.indexOf(element);
        if (index !== -1) {
          siblings.splice(index, 1);
        }
        element.parentNode = null;
      }
    },
    addEventListener(name, handler) {
      element.listeners[name] = handler;
    },
    dispatchEvent(event) {
      element.listeners[event.type]?.(event);
    },
    removeEventListener(name) {
      delete element.listeners[name];
    },
    dispatch(name, event) {
      element.listeners[name]?.(event);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    textContent: '',
    get firstChild() {
      return element.children[0] ?? null;
    },
    get nextSibling() {
      const siblings = element.parentNode?.children ?? [];
      const index = siblings.indexOf(element);
      return siblings[index + 1] ?? null;
    },
  };
  return element;
}

/**
 * Creates the document shim.
 * @returns {object} Document shim.
 */
export function createDomShim() {
  const document = {
    createElement(tag) {
      return makeElement(document, tag);
    },
    createElementNS(ns, tag) {
      return makeElement(document, tag, ns);
    },
    createTextNode(text) {
      return { text, textContent: text };
    },
  };
  document.documentElement = makeElement(document, 'html');
  // Plot's pointer/tip dispatching needs a defaultView.Event constructor.
  document.defaultView = {
    Event: class Event {
      constructor(type, options = {}) {
        this.type = type;
        this.bubbles = options.bubbles ?? false;
      }
    },
  };
  return document;
}

/**
 * Creates a host container over the shim: an element whose renderer output
 * is inspectable by the test.
 * @param {object} document Document shim.
 * @returns {object} Container element.
 */
export function createShimContainer(document) {
  return makeElement(document, 'div');
}
