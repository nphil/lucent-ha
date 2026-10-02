/** A whole app-like page the harness can mount as THE panel (`harness.html?scenario=<id>`) instead of the specimen page: a shell with
 * views, a grid, a sheet and toasts wired together the way a real consumer uses the toolkit. Each slice-independent scenario lives in
 * `dev/scenarios/<name>.ts` and exports `scenario: Scenario`; the harness build discovers the folder like it does `dev/specimens`. */
export interface Scenario {
  /** kebab-case, unique: the value of `?scenario=`. */
  id: string;
  title: string;
  /** Creates the panel element, built from `<spec-lu-*>` tags (the toolkit is registered with prefix `spec` before this runs).
   * The harness appends it to `<ha-panel-custom>` and then sets `hass`, `narrow`, `route` and `panel` on it, as Home Assistant does. */
  create(): HTMLElement;
}
