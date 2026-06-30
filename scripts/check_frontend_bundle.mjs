import { readFile } from "node:fs/promises";

import * as esbuild from "esbuild";

const buildOptions = {
  entryPoints: ["static/src/app.js"],
  bundle: true,
  format: "iife",
  charset: "utf8",
  target: "es2020",
  legalComments: "none",
  external: ["/static/vendor/three.module.min.js"],
  write: false,
};

const [result, committed] = await Promise.all([
  esbuild.build(buildOptions),
  readFile("static/app.js", "utf8"),
]);

const generated = result.outputFiles[0]?.text;
const sourceEntrypoint = await readFile("static/src/app.js", "utf8");
const entrypointLines = sourceEntrypoint.trimEnd().split("\n").length;

if (entrypointLines >= 500) {
  console.error(`static/src/app.js has ${entrypointLines} lines; Phase 1 requires it to stay below 500.`);
  process.exit(1);
}

if (generated !== committed) {
  console.error("static/app.js is out of sync with static/src/app.js.");
  console.error("Run `npm run build:frontend` and commit the generated bundle.");
  process.exit(1);
}

console.log("static/app.js is in sync with static/src/app.js.");
console.log(`static/src/app.js entrypoint is ${entrypointLines} line${entrypointLines === 1 ? "" : "s"}.`);
