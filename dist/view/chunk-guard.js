/* Derived from music-assistant/frontend src/plugins/router.ts:711-759 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md). Modified: wraps one dynamic import() instead of hooking a vue-router error handler; also recognises the Firefox and Safari wordings; storage and reload are injectable; the flag is cleared after any successful import; no URL or hash handling. */
const FLAG = "lucent-ha.chunk-reload";
/** What browsers say when a dynamically imported file cannot be loaded (Chrome and Edge, Firefox, Safari), plus
 * the wording of bundlers that load their own chunks. Errors thrown by the loaded file's own code never match. */
const CHUNK_MESSAGES = [
    "Failed to fetch dynamically imported module",
    "error loading dynamically imported module",
    "Importing a module script failed",
    "Loading chunk",
    "Loading CSS chunk",
];
/** Runs `importer` (a function that calls `import()`). If the file cannot be loaded, reloads the page ONCE and
 * still throws the error, so the caller can show its error state until the reload happens. A second failure
 * without a successful import in between (the server is down, not updated) only throws: no reload loop. Every
 * other error is thrown untouched. */
export async function importWithReload(importer, options = {}) {
    const storage = options.storage ?? sessionStorageOrNothing();
    try {
        const loaded = await importer();
        try {
            storage?.removeItem(FLAG);
        }
        catch {
            // Storage is blocked: no flag was ever set.
        }
        return loaded;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (storage && CHUNK_MESSAGES.some((known) => message.includes(known)) && claimReload(storage)) {
            console.warn("lucent-ha: loading a view failed, probably because the app was updated. Reloading once.", error);
            (options.reload ?? (() => location.reload()))();
        }
        throw error;
    }
}
/** True the first time since the last successful import; false when a reload was already tried or storage is blocked. */
function claimReload(storage) {
    try {
        if (storage.getItem(FLAG))
            return false;
        storage.setItem(FLAG, "1");
        return true;
    }
    catch {
        return false; // without a working flag a reload loop could not be stopped
    }
}
function sessionStorageOrNothing() {
    try {
        return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
    }
    catch {
        return undefined;
    }
}
