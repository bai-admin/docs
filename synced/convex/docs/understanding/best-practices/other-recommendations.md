---
title: "Other Recommendations"
sidebar_position: 170
sidebar_class_name: "hidden"
pagination_next: null
---





{/* This page was previously the Best Practices page which has been rewritten */}
{/* with some of this content dropped. We are keeping this as a hidden page that is */}
{/* still scrape-able */}

Here's a collection of our recommendations on how best to use Convex to build
your application. If you want guidance specific to your app's needs or have
discovered other ways of using Convex,
[message us on Discord](https://convex.dev/community)!

## Use [TypeScript](/understanding/best-practices/typescript.mdx)

All Convex libraries have complete type annotations and using theses types is a
great way to learn the framework.

Even better, Convex supports [code generation](/generated-api/) to create types
that are specific to your app's [schema](/database/schemas.mdx) and
[Convex functions](/functions.mdx).

Code generation is run automatically by
[`npx convex dev`](/cli.md#run-the-convex-dev-server).

## Check generated code into version control

Inside the convex folder is a `_generated/` directory containing code customized
to your convex functions. Check this folder in to your git repo. That way your
code will typecheck without needing to run `npx convex codegen` or
`npx convex dev` (which includes codegen) first.

This also allows developers to make changes to a project that uses convex by
running it against the production deployment by setting an environment variable,
without ever needing to run the Convex CLI tool. To run against a production
deployment set an environment variable like VITE_CONVEX_URL (the exact variable
name depends on the framework you use) to a production deployment URL like
`https://happy-otter-123.convex.cloud` found in project's production deployment
settings in the dashboard. Most frameworks search for variables like this in a
file called `.env` or `.env.production`.

## Functions

### Use [argument validation](/functions/validation.mdx) in all public functions.

Argument validation prevents malicious users from calling your functions with
the wrong types of arguments. It's okay to skip argument validation for
[internal functions](/functions/internal-functions.mdx) because they are not
publicly accessible.

### Use `console.log` to debug your Convex functions.

All server-side logs from Convex functions are shown on the
[dashboard Logs page](/dashboard/deployments/logs.md). If a server-side
exception occurs, it will also be logged as an error event.

On a **dev deployment** the logs will also be forwarded to the client and will
show up in the browser developer tools Console for the user who invoked the
function call, including full server error messages and server-side stack
traces.

### Use helper functions to write shared code.

Write helper functions in your `convex/` directory and use them within your
Convex functions. Helpers can be a powerful way to share business logic,
authorization code, and more.

Helper functions allow sharing code while still executing the entire query or
mutation in a single transaction. For actions, sharing code via helper functions
instead of using `ctx.runAction` reduces function calls and resource usage.

See the [TypeScript page](/understanding/best-practices/typescript.mdx) for
useful types.


```ts
import { QueryCtx, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./userHelpers";
import { Doc, Id } from "./_generated/dataModel";

export const remove = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const currentUser = await getCurrentUser(ctx);
    await ensureTeamAdmin(ctx, currentUser, teamId);
    await ctx.db.delete(teamId);
  },
});

async function ensureTeamAdmin(
  ctx: QueryCtx,
  user: Doc<"users">,
  teamId: Id<"teams">,
) {
  // use `ctx.db` to check that `user` is a team admin and throw an error otherwise
}
```

```js
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./userHelpers";

export const remove = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const currentUser = await getCurrentUser(ctx);
    await ensureTeamAdmin(ctx, currentUser, teamId);
    await ctx.db.delete(teamId);
  },
});

async function ensureTeamAdmin(ctx, user, teamId) {
  // use `ctx.db` to check that `user` is a team admin and throw an error otherwise
}
```



```ts
// @snippet start userHelpers
import { Doc } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";

export async function getCurrentUser(ctx: QueryCtx): Promise<Doc<"users">> {
  // load user details using `ctx.auth` and `ctx.db`
  // @snippet end userHelpers
  return null as any;
}
```

```js
// @snippet start userHelpers
export async function getCurrentUser(ctx) {
  // load user details using `ctx.auth` and `ctx.db`
  // @snippet end userHelpers
  return null;
}
```


### Prefer queries and mutations over actions

You should generally avoid using actions when the same goal can be achieved
using queries or mutations. Since actions can have side effects, they can't be
automatically retried nor their results cached. Actions should be used in more
limited scenarios, such as calling third-party services.

## Database

### Use indexes or paginate all large database queries.

[Database indexes](/database/reading-data/indexes/indexes.md) with
[range expressions](/database/reading-data/indexes/indexes.md#querying-documents-using-indexes)
allow you to write efficient database queries that only scan a small number of
documents in the table. [Pagination](/database/pagination.mdx) allows you to
quickly display incremental lists of results. If your table could contain more
than a few thousand documents, you should consider pagination or an index with a
range expression to ensure that your queries stay fast.

For more details, check out our
[Introduction to Indexes and Query Performance](/database/reading-data/indexes/indexes-and-query-perf.md)
article.

### Use tables to separate logical object types.

Even though Convex does support nested documents, it is often better to put
separate objects into separate tables and use `Id`s to create references between
them. This will give you more flexibility when loading and
[querying documents](/database/reading-data/reading-data.mdx).

You can read more about this at [Document IDs](/database/document-ids.mdx).

## UI patterns

### Check for `undefined` to determine if a query is loading.

The [`useQuery` React hook](/api/modules/react#usequery) will return `undefined`
when it is first mounted, before the query has been loaded from Convex. Once a
query is loaded it will never be `undefined` again (even as the data reactively
updates). `undefined` is not a valid return type for queries (you can see the
types that Convex supports at [Data Types](/database/types.md))

You can use this as a signal for when to render loading indicators and
placeholder UI.

### Add optimistic updates for the interactions you want to feel snappy.

By default all relevant `useQuery` hooks will update automatically after a
mutation is synced from Convex. If you would like some interactions to happen
even faster, you can add
[optimistic updates](/client/react/optimistic-updates.mdx) to your `useMutation`
calls so that the UI updates instantaneously.

### Use an exception handling service and error boundaries to manage errors.

Inevitably, your Convex functions will have bugs and hit exceptions. If you have
an exception handling service and error boundaries configured, you can ensure
that you hear about these errors and your users see appropriate UI.

See [Error Handling](/functions/error-handling/error-handling.mdx) for more
information.
