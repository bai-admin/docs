---
title: Queries
sidebar_position: 10
description: "Fetch data from the database with caching and reactivity"
---












Queries are the bread and butter of your backend API. They fetch data from the
database, check authentication or perform other business logic, and return data
back to the client application.

This is an example query, taking in named arguments, reading data from the
database and returning a result:


```ts
import { query } from "./_generated/server";
import { v } from "convex/values";

// Return the last 100 tasks in a given task list.
export const getTaskList = query({
  args: { taskListId: v.id("taskLists") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("taskListId"), args.taskListId))
      .order("desc")
      .take(100);
    return tasks;
  },
});

```


Read on to understand how to build queries yourself.

## Query names

Queries are defined in <LanguageSelector verbose /> files inside your `convex/`
directory.

The path and name of the file, as well as the way the function is exported from
the file, determine the name the client will use to call it:

```ts title="convex/myFunctions.ts"
// This function will be referred to as `api.myFunctions.myQuery`.
export const myQuery = …;

// This function will be referred to as `api.myFunctions.sum`.
export const sum = …;
```

To structure your API you can nest directories inside the `convex/` directory:

```ts title="convex/foo/myQueries.ts"
// This function will be referred to as `api.foo.myQueries.listMessages`.
export const listMessages = …;
```

Default exports receive the name `default`.

```ts title="convex/myFunctions.ts"
// This function will be referred to as `api.myFunctions.default`.
export default …;
```

The same rules apply to [mutations](/functions/mutation-functions.mdx) and
[actions](/functions/actions.mdx), while
[HTTP actions](/functions/http-actions.mdx) use a different routing approach.

Client libraries in languages other than JavaScript and TypeScript use strings
instead of API objects:

- `api.myFunctions.myQuery` is `"myFunctions:myQuery"`
- `api.foo.myQueries.myQuery` is `"foo/myQueries:myQuery"`.
- `api.myFunction.default` is `"myFunction:default"` or `"myFunction"`.

## The `query` constructor

To actually declare a query in Convex you use the `query` constructor function.
Pass it an object with a `handler` function, which returns the query result:


```ts
import { query } from "./_generated/server";

export const myConstantString = query({
  handler: () => {
    return "My never changing string";
  },
});

```


### Query arguments

Queries accept named arguments. The argument values are accessible as fields of
the second parameter of the handler function:


```ts
import { query } from "./_generated/server";

export const sum = query({
  handler: (_, args: { a: number; b: number }) => {
    return args.a + args.b;
  },
});

```


Arguments and responses are automatically serialized and deserialized, and you
can pass and return most value-like JavaScript data to and from your query.

To both declare the types of arguments and to validate them, add an `args`
object using `v` validators:


```ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const sum = query({
  args: { a: v.number(), b: v.number() },
  handler: (_, args) => {
    return args.a + args.b;
  },
});

```


See [argument validation](/functions/validation.mdx) for the full list of
supported types and validators.

The first parameter of the handler function contains the query context.

### Query responses

Queries can return values of any supported
[Convex type](/functions/validation.mdx) which will be automatically serialized
and deserialized.

Queries can also return `undefined`, which is not a valid Convex value. When a
query returns `undefined` **it is translated to `null`** on the client.

### Query context

The `query` constructor enables fetching data, and other Convex features by
passing a [QueryCtx](/generated-api/server.md#queryctx) object to the handler
function as the first parameter:


```ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myQuery = query({
  args: { a: v.number(), b: v.number() },
  handler: (ctx, args) => {
    // Do something with `ctx`
  },
});

```


Which part of the query context is used depends on what your query needs to do:

- To fetch from the database use the `db` field. Note that we make the handler
  function an `async` function so we can `await` the promise returned by
  `db.get()`:

  
```ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getTask = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

```


  Read more about [Reading Data](/database/reading-data/reading-data.mdx).

- To return URLs to stored files use the `storage` field. Read more about
  [File Storage](/file-storage.mdx).
- To check user authentication use the `auth` field. Read more about
  [Authentication](/auth.mdx).

## Splitting up query code via helpers

When you want to split up the code in your query or reuse logic across multiple
Convex functions you can define and call helper <LanguageSelector verbose />
functions:


```ts
import { Id } from "./_generated/dataModel";
import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

export const getTaskAndAuthor = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (task === null) {
      return null;
    }
    return { task, author: await getUserName(ctx, task.authorId ?? null) };
  },
});

async function getUserName(ctx: QueryCtx, userId: Id<"users"> | null) {
  if (userId === null) {
    return null;
  }
  return (await ctx.db.get(userId))?.name;
}

```


You can `export` helpers to use them across multiple files. They will not be
callable from outside of your Convex functions.

See
[Type annotating server side helpers](/understanding/best-practices/typescript.mdx#type-annotating-server-side-helpers)
for more guidance on TypeScript types.

## Using NPM packages

Queries can import NPM packages installed in `node_modules`. Not all NPM
packages are supported, see
[Runtimes](/functions/runtimes.mdx#default-convex-runtime) for more details.

```sh
npm install @faker-js/faker
```


```ts
import { query } from "./_generated/server";
import { faker } from "@faker-js/faker";

export const randomName = query({
  args: {},
  handler: () => {
    faker.seed();
    return faker.person.fullName();
  },
});

```


## Calling queries from clients

To call a query from [React](/client/react.mdx) use the
[`useQuery`](/client/react.mdx#fetching-data) hook along with the generated
[`api`](/generated-api/api) object.


```tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function MyApp() {
  const data = useQuery(api.myFunctions.sum, { a: 1, b: 2 });
  // do something with `data`
}

```


See the [React](/client/react.mdx) client documentation for all the ways queries
can be called.

## Caching & reactivity & consistency

Queries have three awesome attributes:

1. **Caching**: Convex caches query results automatically. If many clients
   request the same query, with the same arguments, they will receive a cached
   response.
2. **Reactivity**: clients can subscribe to queries to receive new results when
   the underlying data changes.
3. **Consistency**: All database reads inside a single query call are performed
   at the same logical timestamp. Concurrent writes do not affect the query
   results.

To have these attributes the handler function must be _deterministic_, which
means that given the same arguments (including the query context) it will return
the same response.

For this reason queries cannot `fetch` from third party APIs. To call third
party APIs, use [actions](/functions/actions.mdx).

You might wonder whether you can use non-deterministic language functionality
like `Math.random()` or `Date.now()`. The short answer is that Convex takes care
of implementing these in a way that you don't have to think about the
deterministic constraint.

See [Runtimes](/functions/runtimes.mdx#default-convex-runtime) for more details
on the Convex runtime.

## Limits

Queries have a limit to the amount of data they can read at once to guarantee
good performance. Check out these limits in
[Read/write limit errors](/functions/error-handling/error-handling.mdx#readwrite-limit-errors).

For information on other limits, see [Limits](/production/state/limits.mdx).
