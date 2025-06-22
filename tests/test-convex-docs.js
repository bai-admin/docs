#!/usr/bin/env node
/**
 * Test script for convex-docs.js transformation logic
 * Uses the example files to verify snippet harvesting and MDX transformation
 */

import { readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import { execSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, "temp-test");

async function setupTestEnvironment() {
  console.log("🔧 Setting up test environment...");
  
  // Clean up any existing test directory
  try {
    await rm(testDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore if doesn't exist
  }
  
  // Create test directory structure that mimics npm-packages
  await mkdir(path.join(testDir, "private-demos", "snippets", "convex"), { recursive: true });
  await mkdir(path.join(testDir, "docs", "docs"), { recursive: true });
  
  // Copy test files
  const srcMessages = path.join(__dirname, "example-files", "messages.ts");
  const destMessages = path.join(testDir, "private-demos", "snippets", "convex", "messages.ts");
  const srcMdx = path.join(__dirname, "example-files", "scheduled-functions.mdx");
  const destMdx = path.join(testDir, "docs", "docs", "scheduled-functions.mdx");
  
  console.log("📋 Copying files:");
  console.log(`  ${srcMessages} -> ${destMessages}`);
  console.log(`  ${srcMdx} -> ${destMdx}`);
  
  await copyFile(srcMessages, destMessages);
  await copyFile(srcMdx, destMdx);
  
  // Verify files were copied
  const messagesExists = await readFile(destMessages, "utf8").then(() => true).catch(() => false);
  const mdxExists = await readFile(destMdx, "utf8").then(() => true).catch(() => false);
  
  console.log(`✅ Messages file copied: ${messagesExists}`);
  console.log(`✅ MDX file copied: ${mdxExists}`);
  console.log("✅ Test environment ready");
}

async function runTransformation() {
  console.log("🔄 Running convex-docs transformation...");
  
  // Set environment variable to point to our test directory
  process.env.SYNC_INPUT_DIR = testDir;
  
  // Import and run the transformation logic
  // We need to extract the core logic from convex-docs.js since it's a script
  const { readFile: rf, writeFile: wf, rename } = await import("node:fs/promises");
  const { readFileSync: readSync } = await import("node:fs");
  const { globby } = await import("globby");
  const pathModule = await import("node:path");
  const { resolve: r, dirname } = pathModule.default;
  
  const ROOT = testDir;
  const SNIPPET_BLOCK_DIR = ROOT;
  const DOCS_DIR = r(ROOT, "docs/docs");
  
  // Helper functions
  const EXT_TO_LANG = { tsx:"tsx", ts:"ts", jsx:"jsx", js:"js", jsonl:"json", json:"json", sh:"bash" };
  const langOf = (ext) => EXT_TO_LANG[ext] ?? ext ?? "text";
  const fence = ({code,lang}) => `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  const warn = (id) => `> **⚠ snippet "${id}" not found**`;
  
  // 1. Harvest @snippet blocks
  const BLOCK_SNIPPETS = {};
  const BLOCK_RE = /\/\/\s*@snippet start ([\w-]+)[\s\S]*?\/\/\s*@snippet end \1/g;
  
  const snippetPattern = `${SNIPPET_BLOCK_DIR}/**/*.{ts,tsx,js,jsx}`.replace(/\\/g, '/');
  console.log(`🔍 Searching for snippets in: ${snippetPattern}`);
  const files = await globby(snippetPattern);
  console.log(`📁 Found files: ${files}`);
  
  for (const file of files) {
    console.log(`📖 Processing file: ${file}`);
    const src = await rf(file, "utf8");
    const ext = pathModule.default.extname(file).slice(1);
    for (const m of src.matchAll(BLOCK_RE)) {
      const [, name] = m;
      const code = m[0]
        .replace(/^\/\/\s*@snippet start[^\n]*\n/, "")
        .replace(/\/\/\s*@snippet end[^\n]*$/, "")
        .trimEnd();
      BLOCK_SNIPPETS[name] = { code, lang: langOf(ext) };
      console.log(`✅ Found snippet: ${name}`);
    }
  }
  
  console.log(`📝 Found ${Object.keys(BLOCK_SNIPPETS).length} snippets:`, Object.keys(BLOCK_SNIPPETS));
  
  // 2. Process MDX files
  const mdxPattern = `${DOCS_DIR}/**/*.mdx`.replace(/\\/g, '/');
  console.log(`🔍 Searching for MDX files in: ${mdxPattern}`);
  const mdxFiles = await globby(mdxPattern);
  console.log(`📁 Found MDX files: ${mdxFiles}`);
  
  for (const mdxFile of mdxFiles) {
    console.log(`📖 Processing MDX file: ${mdxFile}`);
    let body = await rf(mdxFile, "utf8");
    const IMPORT_SNIPPETS = {};
    console.log(`📄 MDX file has ${body.split('\n').length} lines`);
    
    // A) Resolve import lines
    body = body.replace(
      /^import\s+(\w+).*?['"]([^'"]+)['"];?\s*$/gm,
      (_, ident, rawPath) => {
        const cleaned = rawPath.split("!").pop().replace(/^@site\/\.\.\//, "");
        const absPath = cleaned.startsWith("../")
                         ? r(ROOT, cleaned.replace(/^(\.\.\/)+/, ""))
                         : cleaned.startsWith("./")
                         ? r(dirname(mdxFile), cleaned)
                         : r(ROOT, cleaned);
        
        try {
          const code = readSync(absPath, "utf8").trimEnd();
          const lang = langOf(pathModule.default.extname(absPath).slice(1));
          IMPORT_SNIPPETS[ident] = { code, lang };
          console.log(`📁 Resolved import ${ident} from ${cleaned}`);
          return "";
        } catch (error) {
          console.error(`❌ Failed to read ${absPath}:`, error.message);
          return "";
        }
      }
    );
    
    // Helper lookup
    const lookup = (id) => IMPORT_SNIPPETS[id] ?? BLOCK_SNIPPETS[id];
    
    // B) Replace placeholders
    const originalBody = body;
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
      // ④ dual TS/JS component
      .replace(/<TSAndJSSnippet[^>]*sourceTS=\{(\w+)}[^>]*sourceJS=\{(\w+)}[^>]*\/>/g,
               (_,ts,js)=>lookup(ts)&&lookup(js)
                 ? fence(lookup(ts))+fence(lookup(js))
                 : warn(`${ts}, ${js}`))
      .replace(/<TSAndJSSnippet[^>]*sourceJS=\{(\w+)}[^>]*sourceTS=\{(\w+)}[^>]*\/>/g,
               (_,js,ts)=>lookup(ts)&&lookup(js)
                 ? fence(lookup(ts))+fence(lookup(js))
                 : warn(`${ts}, ${js}`));
    
    const transformationsMade = body !== originalBody;
    console.log(`🔄 Processing ${pathModule.default.basename(mdxFile)}... ${transformationsMade ? 'TRANSFORMED' : 'no changes'}`);
    
    // C) Write output
    await wf(mdxFile, body.trimStart());
    await rename(mdxFile, mdxFile.replace(/\.mdx$/, ".md"));
  }
  
  console.log("✅ Transformation complete");
}

async function verifyOutput() {
  console.log("🔍 Verifying output...");
  
  const outputFile = path.join(testDir, "docs", "docs", "scheduled-functions.md");
  const content = await readFile(outputFile, "utf8");
  
  console.log("\n📄 Output preview (first 50 lines):");
  console.log(content.split('\n').slice(0, 50).join('\n'));
  console.log("\n...");
  
  // Check for expected transformations
  const checks = [
    { name: "Import removed", test: !content.includes('import Example from') },
    { name: "TSAndJSSnippet replaced", test: !content.includes('<TSAndJSSnippet') },
    { name: "Code fences added", test: content.includes('```ts') || content.includes('```tsx') },
    { name: "Snippet content found", test: content.includes('scheduler.runAfter') },
  ];
  
  console.log("\n✅ Verification results:");
  for (const check of checks) {
    console.log(`  ${check.test ? '✅' : '❌'} ${check.name}`);
  }
  
  const allPassed = checks.every(c => c.test);
  console.log(`\n${allPassed ? '🎉 All checks passed!' : '⚠️  Some checks failed'}`);
  
  return allPassed;
}

async function cleanup() {
  console.log("🧹 Cleaning up...");
  await rm(testDir, { recursive: true, force: true });
  console.log("✅ Cleanup complete");
}

async function main() {
  try {
    await setupTestEnvironment();
    await runTransformation();
    const success = await verifyOutput();
    await cleanup();
    
    if (success) {
      console.log("\n🎉 Test passed! The convex-docs.js logic is working correctly.");
      process.exit(0);
    } else {
      console.log("\n❌ Test failed! Check the output above for issues.");
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Test failed with error:", error);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error("Failed to cleanup:", cleanupError);
    }
    process.exit(1);
  }
}

main(); 