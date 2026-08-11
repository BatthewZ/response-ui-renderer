#!/usr/bin/env bun
/**
 * Writes the theme contract where the shipped builder can read it.
 *
 * The parsing lives in `theme-template.ts`, which the drift test imports too —
 * see the note there for why the contract is read at build time rather than at
 * runtime.
 *
 * Usage: bun scripts/gen-theme-tokens.mjs [--check]
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { OUTPUT_PATH, parseThemeTemplate, TEMPLATE_PATH } from "./theme-template.ts";

const tokens = parseThemeTemplate(readFileSync(TEMPLATE_PATH, "utf8"));
if (tokens.length === 0) {
  console.error(`${TEMPLATE_PATH} yielded no tokens — the template's shape has changed.`);
  process.exit(1);
}

const body = `${JSON.stringify(tokens, null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(OUTPUT_PATH, "utf8") !== body) {
    console.error(`${path.basename(OUTPUT_PATH)} stale — run \`bun run theme:tokens\`.`);
    process.exit(1);
  }
  console.log("theme-tokens.json is up to date.");
} else {
  writeFileSync(OUTPUT_PATH, body);
  const groups = new Set(tokens.map((token) => token.group));
  console.log(
    `theme-tokens.json regenerated (${tokens.length} tokens in ${groups.size} groups, ` +
      `${tokens.filter((token) => token.responsive).length} responsive).`,
  );
}
