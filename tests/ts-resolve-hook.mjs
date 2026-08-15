/**
 * The resolver half of tests/ts-resolve.mjs — runs on the loader thread.
 *
 * TypeScript's "bundler" resolution lets application source write `./site-url`
 * or `./site.config` without a file extension; Node's ESM resolver requires the
 * real filename. Rather than change application code to suit the tests, this
 * appends the extension the compiler would have resolved to.
 *
 * NOTE: it must not decide "already has an extension" by pattern-matching the
 * suffix. `./site.config` looks extensioned and is not — that mistake made the
 * first version of this hook fail on exactly one import.
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".json"];

const isFile = (url) => {
  try {
    const p = fileURLToPath(url);
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
};

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const asWritten = new URL(specifier, context.parentURL);
    if (!isFile(asWritten)) {
      for (const ext of EXTENSIONS) {
        if (isFile(new URL(specifier + ext, context.parentURL))) {
          return next(specifier + ext, context);
        }
      }
      // Directory import: ./thing -> ./thing/index.ts
      for (const ext of EXTENSIONS) {
        if (isFile(new URL(`${specifier}/index${ext}`, context.parentURL))) {
          return next(`${specifier}/index${ext}`, context);
        }
      }
    }
  }
  return next(specifier, context);
}
