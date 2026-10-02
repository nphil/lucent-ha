import type { PropertyValues, TemplateResult } from "lit";
import { LuElement } from "../core/element.js";
import type { LuElementClass } from "../core/element.js";
import type { LuScroller } from "../core/scroller.js";
import type { HomeAssistant } from "../ha/types.js";
import type { NavMode, ProfileState } from "../tokens/profile-model.js";
import type { LuDestination } from "./nav-model.js";
/** `auto`: Home Assistant's menu button when the sidebar is a drawer; `menu`: always; `back`: a back arrow (sub-pages); `none`. */
export type LuLeading = "auto" | "menu" | "back" | "none";
/** How wide the content may grow: `grid` 1600px, `text` 1100px, `none` unlimited. */
export type LuContentMax = "grid" | "text" | "none";
/** `document`: the page scrolls (a Home Assistant panel). `contained`: the shell has its own scroll area. */
export type LuScrollMode = "document" | "contained";
/** What `lu-wall-change` carries. */
export interface LuWallChangeDetail {
    wall: boolean;
}
/** The frame of a Home Assistant panel: a sticky app bar, the panel's destinations as tabs, pills, a bottom bar or a
 * left rail (whichever fits the panel's own width and the screen's height), the content, an optional strip pinned
 * above the bottom bar, and the toast host. It also declares the design tokens and the device profile for everything
 * inside, so a panel needs no other root.
 *
 * Home Assistant draws no header for a custom panel and scrolls the page itself, so by default (`scroll="document"`)
 * the bars are `position: sticky` in the page and the shell never touches `html` or `body`. It expects Home Assistant's
 * own safe-area padding around the panel (the default; do not register the panel with `handle_safe_area`), pulls its
 * bars over that padding so they reach the screen edges, and pads their contents by the safe areas itself.
 * With `scroll="contained"` the shell is `height: 100%` of its parent and scrolls inside itself (specimens, previews),
 * and exposes `luScroller` so a view stack finds that scroll area.
 *
 * The shell never routes. Choosing a destination fires `lu-navigate` (from the nav inside, it crosses the shadow
 * boundary); you navigate and set `current`. `lu-back` fires from the back arrow and from Escape (`leading="back"`).
 * The shell publishes the measured size of its chrome on itself as `--lu-top-chrome`, `--lu-bottom-bar` and
 * `--lu-rail-w`, which views and toasts use to stay clear of it.
 *
 * Home Assistant hands a panel a new `hass` object on every state change in the house; the shell re-renders only
 * when something it reads from it (kiosk mode, sidebar setting, companion sidebar, language) changed. */
export declare class LuAppShell extends LuElement {
    static luName: string;
    static luDeps: readonly LuElementClass[];
    static properties: {
        hass: {
            attribute: boolean;
        };
        narrow: {
            type: BooleanConstructor;
        };
        heading: {
            type: StringConstructor;
        };
        destinations: {
            attribute: boolean;
        };
        current: {
            type: StringConstructor;
        };
        leading: {
            type: StringConstructor;
        };
        wall: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        wallKey: {
            type: StringConstructor;
            attribute: string;
        };
        contentMax: {
            type: StringConstructor;
            attribute: string;
            reflect: boolean;
        };
        scrollMode: {
            type: StringConstructor;
            attribute: string;
            reflect: boolean;
        };
        navMode: {
            type: StringConstructor;
            attribute: string;
        };
        navLabel: {
            type: StringConstructor;
            attribute: string;
        };
        shortcuts: {
            converter: {
                fromAttribute: (value: string | null) => boolean;
            };
        };
    };
    /** Home Assistant's `hass` (only a few of its fields are read; see above). */
    hass: HomeAssistant | undefined;
    /** Home Assistant's `narrow` (screen narrower than 871px). It only decides whether the menu button shows; the layout follows the panel's own size. */
    narrow: boolean;
    /** The page title in the app bar (the current view, or your app's name). It is the page's `h1`. */
    heading: string;
    destinations: readonly LuDestination[];
    /** The id of the current destination; an id that matches none marks nothing as current. */
    current: string;
    leading: LuLeading;
    /** Wall mode (opt-in, for a display on a wall): Home Assistant's own header and sidebar are hidden and the app bar always has its menu button. */
    wall: boolean;
    /** With a key, this device remembers wall mode (read once when the shell connects; an explicit `wall` wins). Set it in the markup. */
    wallKey: string;
    contentMax: LuContentMax;
    /** Attribute `scroll`. (The JS property is `scrollMode` because `scroll` is a built-in method of every element.) */
    scrollMode: LuScrollMode;
    /** `auto` (default) follows the screen; `tabs`, `pills`, `bottom` or `rail` force one layout, for design review and previews. */
    navMode: "auto" | NavMode;
    /** Names the destinations' navigation landmark for screen readers. */
    navLabel: string;
    /** Digits 1-9 (or each destination's `shortcut`) jump to a destination on screens with a mouse or trackpad. `shortcuts="false"` turns them off. */
    shortcuts: boolean;
    private readonly _profile;
    /** The panel's own width in px as last measured (0 before the first measurement). */
    get panelWidth(): number;
    /** The device profile the shell works with: `{ profile, short, touch, nav }` (see `lu-profile-change`). */
    get profile(): ProfileState;
    private readonly _meter;
    private readonly _wallMode;
    private _wallRestored;
    private _wallCommitted;
    private _stopPresses;
    private _scroller;
    constructor();
    /** The scroll area of a `contained` shell, for `findScroller` (a view stack inside it saves and restores scroll there). In `document` mode there is none: the page scrolls. */
    get luScroller(): LuScroller | undefined;
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected shouldUpdate(changed: PropertyValues): boolean;
    protected willUpdate(): void;
    protected updated(changed: PropertyValues): void;
    /** The layout in force: the forced one, or what the panel's size and the screen's height ask for. */
    private _navMode;
    /** `data-lu-nav` on the host tells views and consumers which layout is showing; it follows a forced `nav-mode` too. */
    private _syncNavAttribute;
    /** First connect only: with a `wall-key`, start from what this device remembered. */
    private _restoreWall;
    /** The wall state changed: switch kiosk mode, remember it when there is a key, and tell the app. */
    private _commitWall;
    private _onKeydown;
    private _onToast;
    private _label;
    private _renderLeading;
    private _renderNav;
    render(): TemplateResult;
    static styles: import("lit").CSSResult[];
}
declare global {
    interface HTMLElementEventMap {
        "lu-back": CustomEvent<undefined>;
        "lu-wall-change": CustomEvent<LuWallChangeDetail>;
        /** The device profile changed (also fired by `lu-root`): detail is `{ profile, short, touch, nav }`. */
        "lu-profile-change": CustomEvent<ProfileState>;
    }
}
