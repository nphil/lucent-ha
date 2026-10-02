/** Loading a view's code lazily (`import("./insights.js")`) fails after an app update when the old file names
 * are gone from the server and the page still asks for them. Reloading the page fetches the new ones. */
export interface ChunkGuardOptions {
    /** Where the "already reloaded once" flag lives (default `sessionStorage`). */
    storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
    /** Reloads the page (default `location.reload()`). */
    reload?: () => void;
}
/** Runs `importer` (a function that calls `import()`). If the file cannot be loaded, reloads the page ONCE and
 * still throws the error, so the caller can show its error state until the reload happens. A second failure
 * without a successful import in between (the server is down, not updated) only throws: no reload loop. Every
 * other error is thrown untouched. */
export declare function importWithReload<T>(importer: () => Promise<T>, options?: ChunkGuardOptions): Promise<T>;
