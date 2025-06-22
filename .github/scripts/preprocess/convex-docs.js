#!/usr/bin/env node
/**
 * Converts Convex MDX docs to plain Markdown by injecting live code.
 * Works no matter what directory the workflow chose as CWD because it
 * derives paths from SYNC_INPUT_DIR (exported by the workflow).
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { readFileSync as readSync, existsSync, statSync } from "node:fs";
import { globby } from "globby";
import * as path from "node:path";
const { resolve: r, dirname } = path;

// ───────────────────────────── setup root dirs ──────────────────────────────
const ROOT = process.env.SYNC_INPUT_DIR         // exported by workflow
           ? r(process.env.SYNC_INPUT_DIR)
           : r(process.cwd());

/* input tree looks like:
      ROOT/                          (npm-packages)
        ├─ docs/docs/                (MDX)
        ├─ private-demos/…           (snippet sources)
        └─ demos/…                   (snippet sources)
*/
const SNIPPET_BLOCK_DIR = ROOT;
const DOCS_DIR          = r(ROOT, "docs/docs");

// ─────────────────────────── helpers ─────────────────────────────
const EXT_TO_LANG = { tsx:"tsx", ts:"ts", jsx:"jsx", js:"js",
                      jsonl:"json", json:"json", sh:"bash" };
const langOf  = (ext) => EXT_TO_LANG[ext] ?? ext ?? "text";
const fence   = ({code,lang}) =>
  `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
const warn    = (id) =>
  `> **⚠ snippet “${id}” not found**`;

// Helper: try to resolve an identifier to ONE snippet block
function lookupSnippet(id) {
  if (BLOCK_SNIPPETS[id]) return BLOCK_SNIPPETS[id];

  const matches = Object.entries(BLOCK_SNIPPETS)
    .filter(([name]) => name.endsWith(id))
    .map(([, snippet]) => snippet);

  return matches.length === 1 ? matches[0] : undefined;
}

// ───────────────────────── 2. walk every .mdx file ───────────────
for (const mdxFile of await globby(`${DOCS_DIR}/**/*.mdx`)) {
  let body = await readFile(mdxFile, "utf8");
  const IMPORT_SNIPPETS = {};

  // A) resolve and strip import lines (raw‑loader or relative)
  body = body.replace(
    /^import\s+(\w+).*?['"]([^'"]+)['"];?\s*$/gm,
    (_, ident, rawPath) => {
      // normalise path → absPath  (unchanged from your version)
      const cleaned = rawPath.split("!").pop().replace(/^@site\/\.\.\//, "");
      const absPath = cleaned.startsWith("../")
        ? r(ROOT, cleaned.replace(/^(\.\.\/)+/, ""))
        : cleaned.startsWith("./")
        ? r(dirname(mdxFile), cleaned)
        : r(ROOT, cleaned);

      const snip = lookupSnippet(ident);
      if (snip) {
        IMPORT_SNIPPETS[ident] = snip;
      } else {
        console.warn(
          `⚠ no unique snippet for identifier “${ident}” (import ${rawPath})`
        );
      }
      return "";                       // always drop the import line
    });

  // helper alias for later
  const lookup = (id) => IMPORT_SNIPPETS[id] ?? BLOCK_SNIPPETS[id];

  // B) placeholder replacements (unchanged except uses new helper)
  body = body
    .replace(/{\/\*\s*@snippet\s+([\w-]+)\s*\*\/}/g,
             (_, id) => lookup(id) ? fence(lookup(id)) : warn(id))
    .replace(/<Snippet[^>]*\bname=["']([\w-]+)["'][^>]*\/>/g,
             (_, id) => lookup(id) ? fence(lookup(id)) : warn(id))
    .replace(/<Snippet[\s\S]*?\bsource=\{(\w+)}[\s\S]*?\/>/g,
             (_, id) => lookup(id) ? fence(lookup(id)) : warn(id))
    .replace(/<TSAndJSSnippet[^>]*sourceTS=\{(\w+)}[^>]*sourceJS=\{(\w+)}[^>]*\/>/g,
             (_, ts, js) => lookup(ts)&&lookup(js)
               ? fence(lookup(ts)) + fence(lookup(js))
               : warn(`${ts}, ${js}`))
    .replace(/<TSAndJSSnippet[^>]*sourceJS=\{(\w+)}[^>]*sourceTS=\{(\w+)}[^>]*\/>/g,
             (_, js, ts) => lookup(ts)&&lookup(js)
               ? fence(lookup(ts)) + fence(lookup(js))
               : warn(`${ts}, ${js}`));

  // C) write back as .md
  await writeFile(mdxFile, body.trimStart());
  await rename(mdxFile, mdxFile.replace(/\.mdx$/, ".md"));

}
