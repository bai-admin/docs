---
title: ESLint rules
sidebar_position: 30
description: ESLint rules for Convex
---

ESLint rules for Convex functions enforce best practices. Let us know if there's
a rule you would find helpful!

<BetaAdmonition feature="Convex ESLint rules" verb="are" />

## Setup

For ESLint 9 (flat config, using `eslint.config.js`), install the rules with:

```bash
npm i @convex-dev/eslint-plugin --save-dev
```

and add this to your `eslint.config.js` file:

```ts

import { defineConfig } from "eslint/config";

export default defineConfig([
  // Other configurations

  ...convexPlugin.configs.recommended,
]);
```

<Details summary={<>If you’re using the deprecated <code>.eslintrc.js</code> format</>}>

Install these two libraries:

```bash
npm i @typescript-eslint/eslint-plugin @convex-dev/eslint-plugin --save-dev
```

In `.eslintrc.js`, add:

```js
module.exports =
  extends: [
    // Other configurations
    "plugin:@typescript-eslint/recommended",
    "plugin:@convex-dev/recommended",
  ],
  ignorePatterns: ["node_modules/", "dist/", "build/"],
};
```

</Details>

## Rules

| Rule                                                                                                                                          | Recommended | Auto-fixable |
| --------------------------------------------------------------------------------------------------------------------------------------------- | :---------: | :----------: |
| [`@convex-dev/no-old-registered-function-syntax`](#no-old-registered-function-syntax)<br/>Prefer object syntax for registered functions       |     ✅      |      🔧      |
| [`@convex-dev/no-missing-args-validator`](#no-missing-args-validator)<br/>Require argument validators for all Convex functions                |             |      🔧      |
| [`@convex-dev/no-args-without-validator`](#no-args-without-validator)<br/>Require argument validators for all Convex functions with arguments |     ✅      |      🔧      |
| [`@convex-dev/import-wrong-runtime`](#import-wrong-runtime)<br/>Prevent Convex runtime files from importing from Node runtime files           |             |              |

### no-old-registered-function-syntax

Prefer object syntax for registered functions.

Convex queries, mutations, and actions can be defined with a single function or
with an object containing a handler property. Using the objects makes it
possible to add argument and return value validators, so is always preferable.

```ts
// ✅ Allowed by this rule:
export const list = query({
  handler: async (ctx) => {
    const data = await ctx.db.query("messages").collect();
    ...
  },
});

// ❌ Not allowed by this rule:
export const list = query(async (ctx) => {
  const data = await ctx.db.query("messages").collect();
  ...
});
```

### no-missing-args-validator

Require argument validators for all Convex functions.

Convex queries, mutations, and actions can validate their arguments before
beginning to run the handler function. Besides being a concise way to validate,
the types of arguments, using argument validators enables generating more
descriptive function specs and therefore OpenAPI bindings.

```ts
// ✅ Allowed by this rule:
export const list = query({
  args: {},
  handler: async (ctx) => {
    ...
  },
});

// ✅ Allowed by this rule:
export const list = query({
  args: { channel: v.id('channel') },
  handler: async (ctx, { channel }) => {
    ...
  },
});

// ❌ Not allowed by this rule:
export const list = query({
  handler: async (ctx) => {
    ...
  },
});

// ❌ Not allowed by this rule:
export const list = query({
  handler: async (ctx, { channel }: { channel: Id<"channel"> }) => {
    ...
  },
});
```

### no-args-without-validator

Require argument validators for all Convex functions with arguments.

This rule is similar to
[`no-missing-args-validator`](#no-missing-args-validator), but it doesn’t throw
an error if the function has no arguments.

```ts
// ✅ Allowed by this rule:
export const list = query({
  args: {},
  handler: async (ctx) => {
    ...
  },
});

// ✅ Allowed by this rule:
export const list = query({
  args: { channel: v.id('channel') },
  handler: async (ctx, { channel }) => {
    ...
  },
});

// ✅ Allowed by this rule:
export const list = query({
  handler: async (ctx) => {
    ...
  },
});

// ❌ Not allowed by this rule:
export const list = query({
  handler: async (ctx, { channel }: { channel: Id<"channel"> }) => {
    ...
  },
});
```

### import-wrong-runtime

Prevent Convex runtime files from importing from Node runtime files (files with
a `"use node"` directive).

This rule is experimental. Please let us know if you find it helpful!

```ts
// In a file that doesn’t use `"use node"`:

// ✅ Allowed by this rule:
import { someFunction } from "./someOtherFile"; // where someOtherFile doesn't use `"use node"`

// ❌ Not allowed by this rule:
import { someFunction } from "./someNodeFile"; // where someNodeFile uses `"use node"`
```
