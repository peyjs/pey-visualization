// The active-chart registry: every chart's identity, container, current
// spec and renderer handle. Entries are kept by reference so the service's
// live mutations stay visible; removal frees everything a chart kept and
// leaves the other charts untouched; shutdown removes all of them.

/**
 * Creates a fresh empty chart store.
 * @returns {{add: Function, get: Function, has: Function, remove: Function, removeAll: Function, ids: Function}} Store.
 */
export function createChartStore() {
  const charts = new Map();

  return {
    /**
     * Registers a chart (the entry object is kept by reference and gains
     * its `id`) and returns the generated unique id.
     * @param {object} entry { element, renderer, spec, options, data }.
     * @returns {string} Chart id.
     */
    add(entry) {
      const id = `chart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      entry.id = id;
      charts.set(id, entry);
      return id;
    },

    /**
     * Returns a live chart entry, or undefined.
     * @param {string} id Chart id.
     * @returns {object|undefined} Entry.
     */
    get(id) {
      return charts.get(id);
    },

    /**
     * Whether a chart with this id is alive.
     * @param {string} id Chart id.
     * @returns {boolean} True when alive.
     */
    has(id) {
      return charts.has(id);
    },

    /**
     * Removes one chart and returns the removed entry for the caller's
     * cleanup (releasing the renderer handle).
     * @param {string} id Chart id.
     * @returns {object|undefined} The removed entry.
     */
    remove(id) {
      const entry = charts.get(id);
      charts.delete(id);
      return entry;
    },

    /**
     * Removes every chart (plugin shutdown) and returns their entries.
     * @returns {Array} Removed entries.
     */
    removeAll() {
      const entries = [...charts.values()];
      charts.clear();
      return entries;
    },

    /**
     * Snapshots the live chart ids.
     * @returns {Array<string>} Ids.
     */
    ids() {
      return [...charts.keys()];
    },
  };
}
