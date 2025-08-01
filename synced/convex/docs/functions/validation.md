---
title: "Argument and Return Value Validation"
sidebar_label: "Validation"
sidebar_position: 50
description: "Validate function arguments and return values for security"
---



Argument and return value validators ensure that
[queries](./query-functions.mdx), [mutations](./mutation-functions.mdx), and
[actions](./actions.mdx) are called with the correct types of arguments and
return the expected types of return values.

**This is important for security!** Without argument validation, a malicious
user can call your public functions with unexpected arguments and cause
surprising results. [TypeScript](/understanding/best-practices/typescript) alone
won't help because TypeScript types aren't present at runtime. We recommend
adding argument validation for all public functions in production apps. For
non-public functions that are not called by clients, we recommend
[internal functions](/functions/internal-functions.mdx) and optionally
validation.

**Example:**
[Argument Validation](https://github.com/get-convex/convex-demos/tree/main/args-validation)

## Adding validators

To add argument validation to your functions, pass an object with `args` and
`handler` properties to the `query`, `mutation` or `action` constructor. To add
return value validation, use the `returns` property in this object:


```ts
// @snippet start mutation
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { body, author } = args;
    await ctx.db.insert("messages", { body, author });
  },
});
// @snippet end mutation

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});

```


If you define your function with an argument validator, there is no need to
include [TypeScript](/understanding/best-practices/typescript.mdx) type
annotations! The type of your function will be inferred automatically.
Similarly, if you define a return value validator, the return type of your
function will be inferred from the validator, and TypeScript will check that it
matches the inferred return type of the `handler` function.

Unlike TypeScript, validation for an object will throw if the object contains
properties that are not declared in the validator.

If the client supplies arguments not declared in `args`, or if the function
returns a value that does not match the validator declared in `returns`. This is
helpful to prevent bugs caused by mistyped names of arguments or returning more
data than intended to a client.

Even `args: {}` is a helpful use of validators because TypeScript will show an
error on the client if you try to pass any arguments to the function which
doesn't expect them.

## Supported types

All functions, both public and internal, can accept and return the following
data types. Each type has a corresponding validator that can be accessed on the
[`v`](/api/modules/values#v) object imported from `"convex/values"`.

The [database](/database.mdx) can store the exact same set of
[data types](/database/types.md).

Additionally you can also express type unions, literals, `any` types, and
optional fields.

### Convex values

<ConvexValues />

### Unions

You can describe fields that could be one of multiple types using `v.union`:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    stringOrNumber: v.union(v.string(), v.number()),
  },
  handler: async ({ db }, { stringOrNumber }) => {
    //...
  },
});
```

### Literals

Fields that are a constant can be expressed with `v.literal`. This is especially
useful when combined with unions:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    oneTwoOrThree: v.union(
      v.literal("one"),
      v.literal("two"),
      v.literal("three"),
    ),
  },
  handler: async ({ db }, { oneTwoOrThree }) => {
    //...
  },
});
```

### Record objects

You can describe objects that map arbitrary keys to values with `v.record`:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    simpleMapping: v.record(v.string(), v.boolean()),
  },
  handler: async ({ db }, { simpleMapping }) => {
    //...
  },
});
```

You can use other types of string validators for the keys:

```typescript
defineTable({
  userIdToValue: v.record(v.id("users"), v.boolean()),
});
```

Notes:

- This type corresponds to the
  [Record\<K,V\>](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)
  type in TypeScript
- You cannot use string literals as a `record` key
- Using `v.string()` as a `record` key validator will only allow ASCII
  characters

### Any

Fields that could take on any value can be represented with `v.any()`:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    anyValue: v.any(),
  },
  handler: async ({ db }, { anyValue }) => {
    //...
  },
});
```

This corresponds to the `any` type in TypeScript.

### Optional fields

You can describe optional fields by wrapping their type with `v.optional(...)`:

```typescript
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    optionalString: v.optional(v.string()),
    optionalNumber: v.optional(v.number()),
  },
  handler: async ({ db }, { optionalString, optionalNumber }) => {
    //...
  },
});
```

This corresponds to marking fields as optional with `?` in TypeScript.

## Extracting TypeScript types

The [`Infer`](/api/modules/values#infer) type allows you to turn validator calls
into TypeScript types. This can be useful to remove duplication between your
validators and TypeScript types:

```ts
import { mutation } from "./_generated/server";
import { Infer, v } from "convex/values";

const nestedObject = v.object({
  property: v.string(),
});

// Resolves to `{property: string}`.
export type NestedObject = Infer<typeof nestedObject>;

export default mutation({
  args: {
    nested: nestedObject,
  },
  handler: async ({ db }, { nested }) => {
    //...
  },
});
```
