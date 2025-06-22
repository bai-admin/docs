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

// ───────────────────────────── helpers ──────────────────────────────────────
const EXT_TO_LANG = { tsx:"tsx", ts:"ts", jsx:"jsx", js:"js",
                      jsonl:"json", json:"json", sh:"bash" };
const langOf = (ext) => EXT_TO_LANG[ext] ?? ext ?? "text";
const fence  = ({code,lang}) => `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
const warn   = (id)          => `> **⚠ snippet "${id}" not found**`;

// ───────────────────────── 1. harvest @snippet blocks ───────────────────────
const BLOCK_SNIPPETS = {};                        // { name ➜ {code,lang} }
const BLOCK_RE = /\/\/\s*@snippet start ([\w-]+)[\s\S]*?\/\/\s*@snippet end \1/g;

for (const file of await globby(`${SNIPPET_BLOCK_DIR}/**/*.{ts,tsx,js,jsx}`)) {
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

// ───────────────────────── 2. walk every .mdx file ──────────────────────────
for (const mdxFile of await globby(`${DOCS_DIR}/**/*.mdx`)) {
  let body = await readFile(mdxFile, "utf8");
  const IMPORT_SNIPPETS = {};                       // per‑file import map

  // A) resolve and strip import lines (raw‑loader or relative)
  body = body.replace(
    /^import\s+(\w+).*?['"]([^'"]+)['"];?\s*$/gm,
    (_, ident, rawPath) => {
      const cleaned      = rawPath.split("!").pop().replace(/^@site\/\.\.\//, "");
      const absPath      = cleaned.startsWith("../")
                           ? r(ROOT, cleaned.replace(/^(\.\.\/)+/, ""))
                           : cleaned.startsWith("./")
                           ? r(dirname(mdxFile), cleaned)
                           : r(ROOT, cleaned);
      
      // Check if the path exists and is a file
      if (!existsSync(absPath)) {
        console.warn(`Warning: Import path does not exist: ${absPath} (from ${rawPath} in ${mdxFile})`);
        return ""; // remove the import line but don't add to snippets
      }
      
      if (!statSync(absPath).isFile()) {
        console.warn(`Warning: Import path is not a file: ${absPath} (from ${rawPath} in ${mdxFile})`);
        return ""; // remove the import line but don't add to snippets
      }
      
      const code         = readSync(absPath, "utf8").trimEnd();
      const lang         = langOf(path.extname(absPath).slice(1));
      IMPORT_SNIPPETS[ident] = { code, lang };
      return ""; // remove the import line
    });

  // helper lookup
  const lookup = (id) => IMPORT_SNIPPETS[id] ?? BLOCK_SNIPPETS[id];

  // B) placeholder replacements
  body = body
    // ① {/* @snippet foo */}
    .replace(/{\/\*\s*@snippet\s+([\w-]+)\s*\*\/}/g,
             (_,id)=>lookup(id)?fence(lookup(id)):warn(id))
    // ② <Snippet name="foo" />
    .replace(/<Snippet[^>]*\bname=["']([\w-]+)["'][^>]*\/>/g,
             (_,id)=>lookup(id)?fence(lookup(id)):warn(id))
    // ③ <Snippet source={foo} …/>
    .replace(/<Snippet[\s\S]*?\bsource=\{(\w+)}[\s\S]*?\/>/g,
             (_,id)=>lookup(id)?fence(lookup(id)):warn(id))
    // ④ dual TS/JS component (either attribute order)
    .replace(/<TSAndJSSnippet[^>]*sourceTS=\{(\w+)}[^>]*sourceJS=\{(\w+)}[^>]*\/>/g,
             (_,ts,js)=>lookup(ts)&&lookup(js)
               ? fence(lookup(ts))+fence(lookup(js))
               : warn(`${ts}, ${js}`))
    .replace(/<TSAndJSSnippet[^>]*sourceJS=\{(\w+)}[^>]*sourceTS=\{(\w+)}[^>]*\/>/g,
             (_,js,ts)=>lookup(ts)&&lookup(js)
               ? fence(lookup(ts))+fence(lookup(js))
               : warn(`${ts}, ${js}`));

  // C) write back as .md
  await writeFile(mdxFile, body.trimStart());
  await rename(mdxFile, mdxFile.replace(/\.mdx$/, ".md"));
}
