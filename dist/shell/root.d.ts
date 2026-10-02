import type { PropertyValues } from "lit";
import { LuElement } from "../core/element.js";
import type { LuElementClass } from "../core/element.js";
import type { ProfileState } from "../tokens/profile-model.js";
export type LuRootMode = "panel" | "card";
/** The foundation for anything that is not a whole panel: it declares the design tokens, works out the device
 * profile and gives its content instant press feedback and a toast host. Put your card (or a standalone piece of UI)
 * inside it and everything inside, toolkit elements and your own CSS, can read the `--lu-*` tokens.
 *
 * - `mode="card"` (default): sized by its own width only, never by the window, and adds no global listeners, so
 *   many cards on one dashboard stay cheap.
 * - `mode="panel"`: also follows the window height and input type (short screens, touch or mouse), like the app shell.
 *
 * It sets `data-lu-profile`, `data-lu-short` and `data-lu-touch` on itself, which the tokens switch on. It has no app
 * bar and no navigation; for a full panel use the app shell. Toasts raised anywhere inside it (`showToast`) appear in it. */
export declare class LuRoot extends LuElement {
    static luName: string;
    static luDeps: readonly LuElementClass[];
    static properties: {
        mode: {
            type: StringConstructor;
            reflect: boolean;
        };
    };
    /** Set it in the markup (it is read when the element is connected); changing it later rebuilds the profile. */
    mode: LuRootMode;
    private _profile;
    /** The root's own width in px as last measured (0 before the first measurement). */
    get panelWidth(): number;
    /** The device profile this root resolved: `{ profile, short, touch, nav }` (see `lu-profile-change`). */
    get profile(): ProfileState | undefined;
    private _profileMode;
    private _stopPresses;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected willUpdate(changed: PropertyValues): void;
    /** One profile controller per mode: the mode decides whether it listens to the window. */
    private _syncProfile;
    private _onToast;
    render(): import("lit-html").TemplateResult;
    static styles: import("lit").CSSResult[];
}
