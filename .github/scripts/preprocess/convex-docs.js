#!/usr/bin/env node
/**
 * Convert Convex MDX docs → plain Markdown by in-lining live snippets.
 * Works no matter what the workflow's CWD is – relies on $CLONE_DIR.
 */
import { readFile, writeFile, rename } from "node:fs/promises";
import { globby } from "globby";
import * as path from "node:path";
const { resolve: r } = path;

const CLONE_DIR = process.env.CLONE_DIR;
if (!CLONE_DIR) {
  throw new Error("Missing required environment variable: $CLONE_DIR");
}

/* ────────────── 0. Root directories ────────────── */
// Correctly point to the cloned directory
const ROOT = r(CLONE_DIR); 
// The docs are in the `npm-packages/docs/docs` subdirectory
const DOCS_DIR = r(ROOT, "npm-packages/docs/docs"); 
// The snippets are in the `npm-packages` subdirectory
const SNIP_DIR = r(ROOT, "npm-packages");

console.log("root", ROOT, "docs", DOCS_DIR, "snip", SNIP_DIR);

/* ────────────── helpers ────────────── */
const SNIPPET_IMPORT_RE =
  /^import\s+(\w+).*?['"]([^'"]+\?(?:.*&)?snippet=([\w-]+).*?)['"];?\s*$/;
const RAW_LOADER_RE =
  /^import\s+(\w+).*?['"](?:!!raw-loader!)([^'"]+)['"];?\s*$/;

const EXT_TO_LANG = { tsx: "tsx", ts: "ts", jsx: "jsx", js: "js", jsonl: "json", json: "json", sh: "bash" };
const langOf = (ext) => EXT_TO_LANG[ext] ?? ext ?? "text";
const fence = ({ code, lang }) => `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
const warn = (id) => `> **⚠ snippet " ${id} " not found**`;

/* ────────────── 1. Harvest @snippet blocks ────────────── */
const BLOCK_SNIPPETS = Object.create(null); // name → {code,lang}
const BLOCK_RE = /\/\/\s*@snippet start ([\w-]+)[\s\S]*?\/\/\s*@snippet end \1/g;

// Correctly search for snippets within the SNIP_DIR
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
  // ① exact match
  if (BLOCK_SNIPPETS[id]) return BLOCK_SNIPPETS[id];

  // ② single "ends-with" match
  const hits = Object.entries(BLOCK_SNIPPETS)
    .filter(([name]) => name.endsWith(id));
  return hits.length === 1 ? hits[0][1] : undefined;
}

/* ────────────── 2. Walk every .mdx file ────────────── */
// Correctly search for .mdx files within the DOCS_DIR
for (const mdxFile of await globby(`${DOCS_DIR}/**/*.mdx`)) {
  console.log(`\n🔍 Processing: ${mdxFile}`);
  let body = await readFile(mdxFile, "utf8");
  const IMPORT_SNIPS = Object.create(null);

  /* A) strip & resolve import lines */
  const importLines = [];
  body = body.replace(
    /^import\s+(\w+).*?['"]([^'"]+)['"];?\s*$/gm,
    (match, ident, rawPath) => {
      console.log(`  📥 Found import: ${ident} from ${rawPath}`);
      importLines.push({ match, ident, rawPath });
      return ""; // strip the import line
    }
  );

  // Process imports asynchronously
  for (const { ident, rawPath } of importLines) {
    const reconstructedImport = `import ${ident} from "${rawPath}"`;
    const mRaw = RAW_LOADER_RE.exec(reconstructedImport);
    const mQ = SNIPPET_IMPORT_RE.exec(reconstructedImport);

    if (!mRaw && !mQ) {
      console.log(`  ⏭️  Skipping non-snippet import: ${ident}`);
      continue; // skip non-relevant imports
    }

    // 1. explicit ?snippet=…
    if (mQ) {
      const snippetId = mQ[3];
      console.log(`  🔎 Looking for explicit snippet: ${snippetId}`);
      const snippet = lookupSnippet(snippetId);
      if (snippet) {
        IMPORT_SNIPS[ident] = snippet;
        console.log(`  ✅ Found snippet ${snippetId} for ${ident}`);
      } else {
        console.warn(`  ⚠️  no snippet found for id " ${snippetId} " specified in import of ${rawPath}`);
      }
      continue;
    }

    // 2. raw-loader path
    if (mRaw) {
      const filePath = mRaw[2]; // Extract the actual file path from the regex match
      console.log(`  🔍 Processing raw-loader import: ${ident} from ${filePath}`);
      // Try to find a named snippet first
      const snippet = lookupSnippet(ident);
      if (snippet) {
        IMPORT_SNIPS[ident] = snippet;
        console.log(`  ✅ Found named snippet for ${ident}`);
      } else {
        // Fallback: inline the entire file that raw-loader points at
        try {
          // Replace @site with the docs directory path
          const resolvedPath = filePath.replace(/^@site\//, "npm-packages/docs/");
          const absPath = r(ROOT, resolvedPath);
          const ext = path.extname(absPath).slice(1);
          const fileContent = await readFile(absPath, "utf8");
          IMPORT_SNIPS[ident] = {
            code: fileContent,
            lang: langOf(ext),
          };
          console.log(`  ✅ Loaded full file for ${ident} from ${resolvedPath} (${fileContent.length} chars)`);
        } catch (err) {
          console.warn(`  ⚠️  Could not read file for " ${ident} " (raw-loader import of ${filePath}): ${err.message}`);
        }
      }
    }
  }

  console.log(`\n  📦 IMPORT_SNIPS keys: ${Object.keys(IMPORT_SNIPS).join(', ')}`);
  
  const lookup = (id) => {
    const result = IMPORT_SNIPS[id] ?? BLOCK_SNIPPETS[id];
    console.log(`  🔍 Lookup for "${id}": ${result ? 'found' : 'NOT FOUND'}`);
    return result;
  };

  /* B) placeholder replacement */
  console.log(`\n  🔄 Starting placeholder replacements...`);
  
  body = body
    .replace(/{\/\*\s*@snippet\s+([\w-]+)\s*\*\/}/g,
      (match, id) => {
        console.log(`  📝 Replacing {/* @snippet ${id} */}`);
        return lookup(id) ? fence(lookup(id)) : warn(id);
      })
    .replace(/<Snippet[^>]*\bname=["']([\w-]+)["'][^>]*\/>/g,
      (match, id) => {
        console.log(`  📝 Replacing <Snippet name="${id}" />`);
        return lookup(id) ? fence(lookup(id)) : warn(id);
      })
    .replace(/<Snippet[\s\S]*?\bsource=\{(\w+)}[\s\S]*?\/>/g,
      (match, id) => {
        console.log(`  📝 Replacing <Snippet source={${id}} />`);
        return lookup(id) ? fence(lookup(id)) : warn(id);
      })
    .replace(/<TSAndJSSnippet[^>]*sourceTS=\{(\w+)}[^>]*sourceJS=\{(\w+)}[^>]*\/>/g,
      (match, ts, js) => {
        console.log(`  📝 Replacing <TSAndJSSnippet sourceTS={${ts}} sourceJS={${js}} /> - only outputting TS version`);
        const tsSnippet = lookup(ts);
        if (tsSnippet) {
          const tsContent = fence(tsSnippet);
          console.log(`    TS content: ${tsContent.substring(0, 50)}...`);
          console.log(`    JS source ignored: ${js}`);
          return tsContent;  // Only return TypeScript content
        }
        return warn(`${ts}`);
      })
    .replace(/<TSAndJSSnippet[^>]*sourceJS=\{(\w+)}[^>]*sourceTS=\{(\w+)}[^>]*\/>/g,
      (match, js, ts) => {
        console.log(`  📝 Replacing <TSAndJSSnippet sourceJS={${js}} sourceTS={${ts}} /> (reversed order) - only outputting TS version`);
        const tsSnippet = lookup(ts);
        if (tsSnippet) {
          const tsContent = fence(tsSnippet);
          console.log(`    TS content: ${tsContent.substring(0, 50)}...`);
          console.log(`    JS source ignored: ${js}`);
          return tsContent;  // Only return TypeScript content
        }
        return warn(`${ts}`);
      });

  /* C) write back as .md */
  console.log(`  💾 Writing back to ${mdxFile} and renaming to .md`);
  await writeFile(mdxFile, body.trimStart());
  await rename(mdxFile, mdxFile.replace(/\.mdx$/, ".md"));
}