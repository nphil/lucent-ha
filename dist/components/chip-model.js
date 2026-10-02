/** The kinds of chip and the icon each one carries by default, so a status never rests on colour alone. Pure. */
import { ICON_ALERT, ICON_ALERT_CIRCLE, ICON_CHECK_CIRCLE, ICON_DOT, ICON_INFO } from "./controls-icons.js";
export const CHIP_KINDS = ["neutral", "positive", "warning", "danger", "info", "live", "evidence"];
const DEFAULT_ICONS = {
    neutral: "",
    positive: ICON_CHECK_CIRCLE,
    warning: ICON_ALERT,
    danger: ICON_ALERT_CIRCLE,
    info: ICON_INFO,
    live: ICON_DOT,
    evidence: "",
};
/** The icon a chip shows: its own `icon` when given, else its kind's default (none for neutral and evidence). */
export function chipIcon(kind, icon) {
    return icon || DEFAULT_ICONS[kind];
}
/** A chip's `kind` attribute can be anything a consumer typed; unknown kinds look neutral. */
export function chipKind(kind) {
    return CHIP_KINDS.includes(kind) ? kind : "neutral";
}
