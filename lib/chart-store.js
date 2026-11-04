// The active-chart registry: every chart's identity, container, current
// spec and renderer handle. Removal frees everything a chart kept and
// leaves the other charts untouched; shutdown removes all of them.

/**
 * Creates a fresh empty chart store.
 * @returns {{add: Function, get: Function, has: Function, remove: Function, removeAll: Function, ids: Function}} Store.
 */
export function createChartStore() {
  const charts = new Map();

  return {
    /**
     * Registers a chart and returns its generated unique id.
     * @param {object} entry { container, element, renderer, handle, spec, options, data }.
     * @returns {string} Chart id.
     */
    add(entry) {
      const id = `chart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      charts.set(id, { ...entry, id });
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
     * Replaces a chart's mutable entry (after an update).
     * @param {string} id Chart id.
     * @param {object} entry New entry.
     * @returns {void}
     */
    set(id, entry) {
      charts.set(id, { ...entry, id });
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
     * Removes one chart: its renderer handle is released and the entry
     * dropped. Returns the removed entry for the caller's cleanup.
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
