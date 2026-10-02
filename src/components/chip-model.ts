/** The kinds of chip and the icon each one carries by default, so a status never rests on colour alone. Pure. */
import { ICON_ALERT, ICON_ALERT_CIRCLE, ICON_CHECK_CIRCLE, ICON_DOT, ICON_INFO } from "./controls-icons.ts";

export type LuChipKind = "neutral" | "positive" | "warning" | "danger" | "info" | "live" | "evidence";

export const CHIP_KINDS: readonly LuChipKind[] = ["neutral", "positive", "warning", "danger", "info", "live", "evidence"];

const DEFAULT_ICONS: Record<LuChipKind, string> = {
  neutral: "",
  positive: ICON_CHECK_CIRCLE,
  warning: ICON_ALERT,
  danger: ICON_ALERT_CIRCLE,
  info: ICON_INFO,
  live: ICON_DOT,
  evidence: "",
};

/** The icon a chip shows: its own `icon` when given, else its kind's default (none for neutral and evidence). */
export function chipIcon(kind: LuChipKind, icon: string): string {
  return icon || DEFAULT_ICONS[kind];
}

/** A chip's `kind` attribute can be anything a consumer typed; unknown kinds look neutral. */
export function chipKind(kind: string): LuChipKind {
  return (CHIP_KINDS as readonly string[]).includes(kind) ? (kind as LuChipKind) : "neutral";
}
