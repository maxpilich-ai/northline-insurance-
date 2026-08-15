/**
 * Registers the module resolver that lets unit tests import the application's
 * TypeScript modules directly, extensionless relative imports and all.
 *
 * Used as:  node --import ./tests/ts-resolve.mjs --experimental-strip-types <test>
 *
 * The resolution logic itself lives in ./ts-resolve-hook.mjs because it runs on
 * a separate loader thread.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts-resolve-hook.mjs", pathToFileURL(import.meta.dirname + "/"));
