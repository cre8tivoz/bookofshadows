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

if (generated !== committed) {
  console.error("static/app.js is out of sync with static/src/app.js.");
  console.error("Run `npm run build:frontend` and commit the generated bundle.");
  process.exit(1);
}

console.log("static/app.js is in sync with static/src/app.js.");
