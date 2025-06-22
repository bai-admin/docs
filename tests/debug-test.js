#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { globby } from "globby";
import * as path from "node:path";

// Test the snippet regex against the actual messages.ts file
const messagesFile = "tests/example-files/messages.ts";
const content = await readFile(messagesFile, "utf8");

console.log("📄 Messages file content (first 30 lines):");
console.log(content.split('\n').slice(0, 30).join('\n'));
console.log("\n" + "=".repeat(50));

// Test the regex
const BLOCK_RE = /\/\/\s*@snippet start ([\w-]+)[\s\S]*?\/\/\s*@snippet end \1/g;
const matches = [...content.matchAll(BLOCK_RE)];

console.log(`\n🔍 Found ${matches.length} snippet matches:`);
matches.forEach((match, i) => {
  console.log(`\n${i + 1}. Snippet: "${match[1]}"`);
  console.log(`   Full match length: ${match[0].length}`);
  console.log(`   Preview: ${match[0].substring(0, 100)}...`);
});

// Test globby pattern
console.log("\n🔍 Testing globby pattern:");
const testDir = "tests/example-files";
const files = await globby(`${testDir}/**/*.{ts,tsx,js,jsx}`);
console.log("Found files:", files); 