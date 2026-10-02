/** Types of the module `dev/build.mjs` generates in memory for the harness (an esbuild plugin; there is no file on disk):
 * which toolkit entry points, specimen files and scenarios exist and compile right now, and what was left out and why. */
declare module "lucent-dev:index" {
  /** A file the build skipped because it does not compile (yet), with esbuild's first message. */
  export interface BuildProblem {
    file: string;
    message: string;
  }
  export interface Loader<T> {
    /** Short name for messages: "shell", "specimens/controls.ts". */
    name: string;
    load(): Promise<T>;
  }
  /** Toolkit modules (area barrels, or the files of an area without a barrel, and src/index.ts): the harness registers every element class they export. */
  export const toolkitLoaders: Loader<Record<string, unknown>>[];
  export const specimenLoaders: Loader<{ specimens: import("./specimen-types.ts").Specimen[] }>[];
  export const scenarioLoaders: Loader<{ scenario: import("./scenario-types.ts").Scenario }>[];
  export const buildProblems: BuildProblem[];
  /** ISO time of the build. */
  export const builtAt: string;
}
