#!/usr/bin/env node
/**
 * Convert Convex MDX docs → plain Markdown by in-lining live snippets.
 * Works no matter what the workflow’s CWD is – relies on $SYNC_INPUT_DIR.
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { readFileSync as readSync, existsSync, statSync } from "node:fs";
import { globby } from "globby";
import * as path from "node:path";
const { resolve: r, dirname } = path;

/* ────────────── 0. Root directories ────────────── */
const ROOT      = process.env.SYNC_INPUT_DIR
                ? r(process.env.SYNC_INPUT_DIR)
                : r(process.cwd());
const DOCS_DIR  = r(ROOT, "docs/docs");          // MDX sources
const SNIP_DIR  = ROOT;                          // any *.tsx?* file

/* ────────────── helpers ────────────── */
const EXT_TO_LANG = { tsx:"tsx", ts:"ts", jsx:"jsx", js:"js",
                      jsonl:"json", json:"json", sh:"bash" };
const langOf  = (ext) => EXT_TO_LANG[ext] ?? ext ?? "text";
const fence   = ({code,lang}) => `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
const warn    = (id) => `> **⚠ snippet “${id}” not found**`;

/* ────────────── 1. Harvest @snippet blocks ────────────── */
const BLOCK_SNIPPETS = Object.create(null);       // name → {code,lang}
const BLOCK_RE = /\/\/\s*@snippet start ([\w-]+)[\s\S]*?\/\/\s*@snippet end \1/g;

for (const file of await globby(`${SNIP_DIR}/**/*.{ts,tsx,js,jsx}`)) {
  const src = await readFile(file, "utf8");
  const ext = path.extname(file).slice(1);
  for (const m of src.matchAll(BLOCK_RE)) {
    const [, name] = m;
    const code = m[0]
      .replace(/^\/\/\s*@snippet start[^\n]*\n/, "")
      .replace(/\/\/\s*@snippet end[^\n]*$/, "")
      .trimEnd();
    BLOCK_SNIPPETS[name] = { code, lang: langOf(ext) };
  }
}

/* helper – resolve an identifier to **one** snippet */
function lookupSnippet(id) {
  if (BLOCK_SNIPPETS[id]) return BLOCK_SNIPPETS[id];

  const matches = Object.entries(BLOCK_SNIPPETS)
    .filter(([name]) => name.endsWith(id))
    .map(([, snip]) => snip);

  return matches.length === 1 ? matches[0] : undefined;
}

/* ────────────── 2. Walk every .mdx file ────────────── */
for (const mdxFile of await globby(`${DOCS_DIR}/**/*.mdx`)) {
  let body = await readFile(mdxFile, "utf8");
  const IMPORT_SNIPS = Object.create(null);

  /* A) strip & resolve import lines */
  body = body.replace(
    /^import\s+(\w+).*?['"]([^'"]+)['"];?\s*$/gm,
    (_, ident, rawPath) => {
      // normalise → absPath (handles ./  ../  @site/../../ )
      const cleaned = rawPath.split("!").pop().replace(/^@site\/\.\.\//, "");
      const absPath = cleaned.startsWith("../")
        ? r(ROOT, cleaned.replace(/^(\.\.\/)+/, ""))
        : cleaned.startsWith("./")
        ? r(dirname(mdxFile), cleaned)
        : r(ROOT, cleaned);

      const snip = lookupSnippet(ident);
      if (snip) {
        IMPORT_SNIPS[ident] = snip;
      } else {
        console.warn(`⚠ no unique snippet for “${ident}” (import ${rawPath})`);
      }
      return "";                       // remove the import line
    });

  const lookup = (id) => IMPORT_SNIPS[id] ?? BLOCK_SNIPPETS[id];

  /* B) placeholder replacement */
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

  /* C) write back as .md */
  await writeFile(mdxFile, body.trimStart());
  await rename(mdxFile, mdxFile.replace(/\.mdx$/, ".md"));
}
