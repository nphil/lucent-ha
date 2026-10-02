/** Lucent device profiles that make sense inside a Home Assistant panel (LANGUAGE.md section 7). */
export type LuProfile = "phone" | "tablet" | "desktop" | "smart";
/** How the primary input works: `touch` = (hover: none) and (pointer: coarse); `fine` = (hover: hover) and
 * (pointer: fine); `mixed` = anything else (a tablet with a mouse, a TV pointer). */
export type LuPointer = "touch" | "fine" | "mixed";
/** Where the destinations live. */
export type NavMode = "tabs" | "pills" | "bottom" | "rail";
export interface ProfileInput {
    /** The panel's own width in CSS px (after Home Assistant's sidebar), never the viewport width. */
    width: number;
    /** The viewport height in CSS px. */
    height: number;
    /** The viewport width; lets a wall display keep its smart profile while Home Assistant's docked sidebar
     * narrows the panel. Defaults to `width`. */
    viewportWidth?: number;
    pointer: LuPointer;
}
export interface ProfileState {
    profile: LuProfile;
    /** Viewport height at or under `LAYOUT.short`. */
    short: boolean;
    /** The primary input is touch only. */
    touch: boolean;
    nav: NavMode;
}
/** Classifies the primary input from the two media features (`hover`, `pointer`). */
export declare function classifyPointer(hover: "hover" | "none" | undefined, pointer: "fine" | "coarse" | "none" | undefined): LuPointer;
/** Where the destinations go for a panel `width` (container px) and viewport height:
 * short -> rail; >= wide -> tabs in the app bar; >= compact -> pills row; otherwise a bottom bar. */
export declare function resolveNavMode(width: number, short: boolean, previous?: NavMode): NavMode;
/** The profile comes from the panel's own size and how it is operated, never from the user agent and never
 * from the viewport width alone (Home Assistant's sidebar takes 56-256 px of it).
 *
 * - smart: touch only, short (<= 500) but not tiny (>= 440), on a wide viewport (a wall display read at
 *   arm's length, e.g. 960x480)
 * - phone: narrow (< 600), or touch held sideways with little height (844x390)
 * - tablet: any other touch panel, or a hover panel under 900
 * - desktop: hover/fine pointer and 900 or more
 * Pass the previous state to apply hysteresis at each threshold. */
export declare function resolveProfile(input: ProfileInput, previous?: ProfileState): ProfileState;
