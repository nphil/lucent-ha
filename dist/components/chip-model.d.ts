export type LuChipKind = "neutral" | "positive" | "warning" | "danger" | "info" | "live" | "evidence";
export declare const CHIP_KINDS: readonly LuChipKind[];
/** The icon a chip shows: its own `icon` when given, else its kind's default (none for neutral and evidence). */
export declare function chipIcon(kind: LuChipKind, icon: string): string;
/** A chip's `kind` attribute can be anything a consumer typed; unknown kinds look neutral. */
export declare function chipKind(kind: string): LuChipKind;
