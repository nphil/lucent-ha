export function fireHaptic(kind) {
    if (typeof window === "undefined")
        return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
}
