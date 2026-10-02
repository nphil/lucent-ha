import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { ProfileState } from "./profile-model.js";
export interface PanelProfileOptions {
    /** `panel` (default): sized by the panel width and the viewport height, listens to window resize.
     * `card`: container queries only, no global listeners, height never matters (a card lives in a dashboard). */
    mode?: "panel" | "card";
    /** Called after the state changed (the host is also asked to re-render). */
    onChange?: (state: ProfileState) => void;
}
/** Keeps `data-lu-profile`, `data-lu-short`, `data-lu-touch` and `data-lu-nav` on the host current, so the token
 * layer switches type, target and margin sizes by profile and the shell picks its navigation, and re-renders
 * the host when they change. The profile comes from the panel's own width (a ResizeObserver, never the
 * viewport width alone), the window height (not the visual viewport, so pinch zoom and the on-screen
 * keyboard cannot flip it) and the primary input (`hover`/`pointer`), never from the user agent. */
export declare class PanelProfile implements ReactiveController {
    width: number;
    height: number;
    state: ProfileState;
    private readonly _host;
    private readonly _card;
    private readonly _onChange?;
    private _observer?;
    private _resolved;
    private _frame;
    constructor(host: ReactiveControllerHost & HTMLElement, options?: PanelProfileOptions);
    hostConnected(): void;
    hostDisconnected(): void;
    /** Re-reads the size and input now (for example after the host was moved or shown). */
    measure(): void;
    private _refresh;
    private _schedule;
    private _apply;
}
