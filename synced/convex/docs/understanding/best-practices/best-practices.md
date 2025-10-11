---
title: "Best Practices"
sidebar_position: 400
toc_max_heading_level: 2
description:
  "Essential best practices for building scalable Convex applications including
  database queries, function organization, validation, and security."
---






This is a list of best practices and common anti-patterns around using Convex.
We recommend going through this list before broadly releasing your app to
production. You may choose to try using all of these best practices from the
start, or you may wait until you've gotten major parts of your app working
before going through and adopting the best practices here.

## Await all Promises

### Why?

Convex functions use async / await. If you don't await all your promises (e.g.
`await ctx.scheduler.runAfter`, `await ctx.db.patch`), you may run into
unexpected behavior (e.g. failing to schedule a function) or miss handling
errors.

### How?

We recommend the
[no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/)
eslint rule with TypeScript.

## Avoid `.filter` on database queries

### Why?

Filtering in code instead of using the `.filter` syntax has the same
performance, and is generally easier code to write. Conditions in `.withIndex`
or `.withSearchIndex` are more efficient than `.filter` or filtering in code, so
almost all uses of `.filter` should either be replaced with a `.withIndex` or
`.withSearchIndex` condition, or written as TypeScript code.

Read through the
[indexes documentation](/database/reading-data/indexes/indexes-and-query-perf.md)
for an overview of how to define indexes and how they work.

### Examples


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


### How?

Search for `.filter` in your Convex codebase — a regex like `\.filter\(\(?q`
will probably find all the ones on database queries.

Decide whether they should be replaced with a `.withIndex` condition — per
[this section](/understanding/best-practices/best-practices.mdx#only-use-collect-with-a-small-number-of-results),
if you are filtering over a large (1000+) or potentially unbounded number of
documents, you should use an index. If not using a `.withIndex` /
`.withSearchIndex` condition, consider replacing them with a filter in code for
more readability and flexibility.

See [this article](https://stack.convex.dev/complex-filters-in-convex) for more
strategies for filtering.

### Exceptions

Using `.filter` on a paginated query (`.paginate`) has advantages over filtering
in code. The paginated query will return the number of documents requested,
including the `.filter` condition, so filtering in code afterwards can result in
a smaller page or even an empty page. Using `.withIndex` on a paginated query
will still be more efficient than a `.filter`.

## Only use `.collect` with a small number of results

### Why?

All results returned from `.collect` count towards database bandwidth (even ones
filtered out by `.filter`). It also means that if any document in the result
changes, the query will re-run or the mutation will hit a conflict.

If there's a chance the number of results is large (say 1000+ documents), you
should use an index to filter the results further before calling `.collect`, or
find some other way to avoid loading all the documents such as using pagination,
denormalizing data, or changing the product feature.

### Example

**Using an index:**


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


**Using pagination:**


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


**Using a limit or denormalizing:**


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


### How?

Search for `.collect` in your Convex codebase (a regex like `\.collect\(` will
probably find these). And think through whether the number of results is small.
This function health page in the dashboard can also help surface these.

The [aggregate component](https://www.npmjs.com/package/@convex-dev/aggregate)
or [database triggers](https://stack.convex.dev/triggers) can be helpful
patterns for denormalizing data.

### Exceptions

If you're doing something that requires loading a large number of documents
(e.g. performing a migration, making a summary), you may want to use an action
to load them in batches via separate queries / mutations.

## Check for redundant indexes

### Why?

Indexes like `by_foo` and `by_foo_and_bar` are usually redundant (you only need
`by_foo_and_bar`). Reducing the number of indexes saves on database storage and
reduces the overhead of writing to the table.


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


### How?

Look through your indexes, either in your `schema.ts` file or in the dashboard,
and look for any indexes where one is a prefix of another.

### Exceptions

`.index("by_foo", ["foo"])` is really an index on the properties `foo` and
`_creationTime`, while `.index("by_foo_and_bar", ["foo", "bar"])` is an index on
the properties `foo`, `bar`, and `_creationTime`. If you have queries that need
to be sorted by `foo` and then `_creationTime`, then you need both indexes.

For example, `.index("by_channel", ["channel"])` on a table of messages can be
used to query for the most recent messages in a channel, but
`.index("by_channel_and_author", ["channel", "author"])` could not be used for
this since it would first sort the messages by `author`.

## Use argument validators for all public functions

### Why?

Public functions can be called by anyone, including potentially malicious
attackers trying to break your app.
[Argument validators](/functions/validation.mdx) (as well as return value
validators) help ensure you're getting the traffic you expect.

### Example


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


### How?

Search for `query`, `mutation`, and `action` in your Convex codebase, and ensure
that all of them have argument validators (and optionally return value
validators). If you have `httpAction`s, you may want to use something like `zod`
to validate that the HTTP request is the shape you expect.

## Use some form of access control for all public functions

### Why?

Public functions can be called by anyone, including potentially malicious
attackers trying to break your app. If portions of your app should only be
accessible when the user is signed in, make sure all these Convex functions
check that `ctx.auth.getUserIdentity()` is set.

You may also have specific checks, like only loading messages that were sent to
or from the current user, which you'll want to apply in every relevant public
function.

Favoring more granular functions like `setTeamOwner` over `updateTeam` allows
more granular checks for which users can do what.

Access control checks should either use `ctx.auth.getUserIdentity()` or a
function argument that is unguessable (e.g. a UUID, or a Convex ID, provided
that this ID is never exposed to any client but the one user). In particular,
don't use a function argument which could be spoofed (e.g. email) for access
control checks.

### Example


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


### How?

Search for `query`, `mutation`, `action`, and `httpAction` in your Convex
codebase, and ensure that all of them have some form of access control.
[Custom functions](https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#custom-functions)
like
[`authenticatedQuery`](https://stack.convex.dev/custom-functions#modifying-the-ctx-argument-to-a-server-function-for-user-auth)
can be helpful.

Some apps use Row Level Security (RLS) to check access to each document
automatically whenever it's loaded, as described in
[this article](https://stack.convex.dev/row-level-security). Alternatively, you
can check access in each Convex function instead of checking access for each
document.

Helper functions for common checks and common operations can also be useful --
e.g. `isTeamMember`, `isTeamAdmin`, `loadTeam` (which throws if the current user
does not have access to the team).

## Only schedule and `ctx.run*` internal functions

### Why?

Public functions can be called by anyone, including potentially malicious
attackers trying to break your app, and should be carefully audited to ensure
they can't be used maliciously. Functions that are only called within Convex can
be marked as internal, and relax these checks since Convex will ensure that
internal functions can only be called within Convex.

### How?

Search for `ctx.runQuery`, `ctx.runMutation`, and `ctx.runAction` in your Convex
codebase. Also search for `ctx.scheduler` and check the `crons.ts` file. Ensure
all of these use `internal.foo.bar` functions instead of `api.foo.bar`
functions.

If you have code you want to share between a public Convex function and an
internal Convex function, create a helper function that can be called from both.
The public function will likely have additional access control checks.

Alternatively, make sure that `api` from `_generated/api.ts` is never used in
your Convex functions directory.

### Examples


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


## Use helper functions to write shared code

### Why?

Most logic should be written as plain TypeScript functions, with the `query`,
`mutation`, and `action` wrapper functions being a thin wrapper around one or
more helper function.

Concretely, most of your code should live in a directory like `convex/model`,
and your public API, which is defined with `query`, `mutation`, and `action`,
should have very short functions that mostly just call into `convex/model`.

Organizing your code this way makes several of the refactors mentioned in this
list easier to do.

See the [TypeScript page](/understanding/best-practices/typescript.mdx) for
useful types.

### Example

**❌** This example overuses `ctx.runQuery` and `ctx.runMutation`, which is
discussed more in the
[Avoid sequential `ctx.runMutation` / `ctx.runQuery` from actions](/understanding/best-practices/best-practices.mdx#avoid-sequential-ctxrunmutation--ctxrunquery-calls-from-actions)
section.


```ts
import {
  ActionBuilder,
  DataModelFromSchemaDefinition,
  GenericDocument,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
  anyApi,
  defineSchema,
  defineTable,
} from "convex/server";
import { GenericId, v } from "convex/values";
/**
 * See the comment at the top of ./index.ts for more details on the
 * goals of these snippets + some strategies for writing syntactically
 * correct code while glossing over some details.
 */

const schema = defineSchema({
  conversations: defineTable({
    members: v.array(v.id("users")),
    summary: v.optional(v.string()),
  }),
  users: defineTable({
    name: v.string(),
  }),
  messages: defineTable({
    conversation: v.id("conversations"),
    author: v.id("users"),
    content: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

declare const OMIT_ME: any;

const api = anyApi;
const internal = anyApi;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

type Doc<T extends keyof DataModel> = DataModel[T]["document"];
type Id<T extends keyof DataModel> = GenericId<T>;

// @snippet start usersWrong
export const getCurrentUser_OMIT_1 = query({
  args: {},
  handler: async (ctx) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new Error("Unauthorized");
    }
    const user = /* query ctx.db to load the user */ OMIT_ME;
    const userSettings = /* load other documents related to the user */ OMIT_ME;
    return { user, settings: userSettings };
  },
});
// @snippet end usersWrong

// @snippet start conversationsWrong
export const listMessages_OMIT_1 = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    const conversation = await ctx.db.get(conversationId);
    if (conversation === null || !conversation.members.includes(user._id)) {
      throw new Error("Unauthorized");
    }
    const messages = /* query ctx.db to load the messages */ OMIT_ME;
    return messages;
  },
});

export const summarizeConversation_OMIT_1 = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(api.conversations.listMessages, {
      conversationId,
    });
    // @skipNextLine
    /* prettier-ignore */
    const summary = /* call some external service to summarize the conversation */ OMIT_ME;
    await ctx.runMutation(api.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsWrong

// @snippet start usersCorrect
export async function getCurrentUser(ctx: QueryCtx) {
  const userIdentity = await ctx.auth.getUserIdentity();
  if (userIdentity === null) {
    throw new Error("Unauthorized");
  }
  const user = /* query ctx.db to load the user */ OMIT_ME;
  const userSettings = /* load other documents related to the user */ OMIT_ME;
  return { user, settings: userSettings };
}
// @snippet end usersCorrect

declare const Users: {
  getCurrentUser: (ctx: QueryCtx) => Promise<Doc<"users">>;
};

// @snippet start conversationsModelCorrect
export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  const user = await Users.getCurrentUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (conversation === null || !conversation.members.includes(user._id)) {
    throw new Error("Unauthorized");
  }
  return conversation;
}

export async function listMessages_OMIT_2(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  await ensureHasAccess(ctx, { conversationId });
  const messages = /* query ctx.db to load the messages */ OMIT_ME;
  return messages;
}

export async function addSummary_OMIT_1(
  ctx: MutationCtx,
  {
    conversationId,
    summary,
  }: { conversationId: Id<"conversations">; summary: string },
) {
  await ensureHasAccess(ctx, { conversationId });
  await ctx.db.patch(conversationId, { summary });
}

export async function generateSummary(
  messages: Doc<"messages">[],
  conversationId: Id<"conversations">,
) {
  // @skipNextLine
  /* prettier-ignore */
  const summary = /* call some external service to summarize the conversation */ OMIT_ME;
  return summary;
}
// @snippet end conversationsModelCorrect

declare const Conversations: {
  addSummary: (
    ctx: MutationCtx,
    {
      conversationId,
      summary,
    }: { conversationId: Id<"conversations">; summary: string },
  ) => Promise<void>;
  listMessages: (
    ctx: QueryCtx,
    { conversationId }: { conversationId: Id<"conversations"> },
  ) => Promise<Doc<"messages">[]>;
  generateSummary: (
    messages: Doc<"messages">[],
    conversationId: Id<"conversations">,
  ) => Promise<string>;
};

// @snippet start conversationsApiCorrect
export const addSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, { conversationId, summary }) => {
    await Conversations.addSummary(ctx, { conversationId, summary });
  },
});

export const listMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    return Conversations.listMessages(ctx, { conversationId });
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(internal.conversations.listMessages, {
      conversationId,
    });
    const summary = await Conversations.generateSummary(
      messages,
      conversationId,
    );
    await ctx.runMutation(internal.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsApiCorrect

```



```ts
import {
  ActionBuilder,
  DataModelFromSchemaDefinition,
  GenericDocument,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
  anyApi,
  defineSchema,
  defineTable,
} from "convex/server";
import { GenericId, v } from "convex/values";
/**
 * See the comment at the top of ./index.ts for more details on the
 * goals of these snippets + some strategies for writing syntactically
 * correct code while glossing over some details.
 */

const schema = defineSchema({
  conversations: defineTable({
    members: v.array(v.id("users")),
    summary: v.optional(v.string()),
  }),
  users: defineTable({
    name: v.string(),
  }),
  messages: defineTable({
    conversation: v.id("conversations"),
    author: v.id("users"),
    content: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

declare const OMIT_ME: any;

const api = anyApi;
const internal = anyApi;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

type Doc<T extends keyof DataModel> = DataModel[T]["document"];
type Id<T extends keyof DataModel> = GenericId<T>;

// @snippet start usersWrong
export const getCurrentUser_OMIT_1 = query({
  args: {},
  handler: async (ctx) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new Error("Unauthorized");
    }
    const user = /* query ctx.db to load the user */ OMIT_ME;
    const userSettings = /* load other documents related to the user */ OMIT_ME;
    return { user, settings: userSettings };
  },
});
// @snippet end usersWrong

// @snippet start conversationsWrong
export const listMessages_OMIT_1 = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    const conversation = await ctx.db.get(conversationId);
    if (conversation === null || !conversation.members.includes(user._id)) {
      throw new Error("Unauthorized");
    }
    const messages = /* query ctx.db to load the messages */ OMIT_ME;
    return messages;
  },
});

export const summarizeConversation_OMIT_1 = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(api.conversations.listMessages, {
      conversationId,
    });
    // @skipNextLine
    /* prettier-ignore */
    const summary = /* call some external service to summarize the conversation */ OMIT_ME;
    await ctx.runMutation(api.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsWrong

// @snippet start usersCorrect
export async function getCurrentUser(ctx: QueryCtx) {
  const userIdentity = await ctx.auth.getUserIdentity();
  if (userIdentity === null) {
    throw new Error("Unauthorized");
  }
  const user = /* query ctx.db to load the user */ OMIT_ME;
  const userSettings = /* load other documents related to the user */ OMIT_ME;
  return { user, settings: userSettings };
}
// @snippet end usersCorrect

declare const Users: {
  getCurrentUser: (ctx: QueryCtx) => Promise<Doc<"users">>;
};

// @snippet start conversationsModelCorrect
export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  const user = await Users.getCurrentUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (conversation === null || !conversation.members.includes(user._id)) {
    throw new Error("Unauthorized");
  }
  return conversation;
}

export async function listMessages_OMIT_2(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  await ensureHasAccess(ctx, { conversationId });
  const messages = /* query ctx.db to load the messages */ OMIT_ME;
  return messages;
}

export async function addSummary_OMIT_1(
  ctx: MutationCtx,
  {
    conversationId,
    summary,
  }: { conversationId: Id<"conversations">; summary: string },
) {
  await ensureHasAccess(ctx, { conversationId });
  await ctx.db.patch(conversationId, { summary });
}

export async function generateSummary(
  messages: Doc<"messages">[],
  conversationId: Id<"conversations">,
) {
  // @skipNextLine
  /* prettier-ignore */
  const summary = /* call some external service to summarize the conversation */ OMIT_ME;
  return summary;
}
// @snippet end conversationsModelCorrect

declare const Conversations: {
  addSummary: (
    ctx: MutationCtx,
    {
      conversationId,
      summary,
    }: { conversationId: Id<"conversations">; summary: string },
  ) => Promise<void>;
  listMessages: (
    ctx: QueryCtx,
    { conversationId }: { conversationId: Id<"conversations"> },
  ) => Promise<Doc<"messages">[]>;
  generateSummary: (
    messages: Doc<"messages">[],
    conversationId: Id<"conversations">,
  ) => Promise<string>;
};

// @snippet start conversationsApiCorrect
export const addSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, { conversationId, summary }) => {
    await Conversations.addSummary(ctx, { conversationId, summary });
  },
});

export const listMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    return Conversations.listMessages(ctx, { conversationId });
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(internal.conversations.listMessages, {
      conversationId,
    });
    const summary = await Conversations.generateSummary(
      messages,
      conversationId,
    );
    await ctx.runMutation(internal.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsApiCorrect

```


**✅** Most of the code here is now in the `convex/model` directory. The API for
this application is in `convex/conversations.ts`, which contains very little
code itself.


```ts
import {
  ActionBuilder,
  DataModelFromSchemaDefinition,
  GenericDocument,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
  anyApi,
  defineSchema,
  defineTable,
} from "convex/server";
import { GenericId, v } from "convex/values";
/**
 * See the comment at the top of ./index.ts for more details on the
 * goals of these snippets + some strategies for writing syntactically
 * correct code while glossing over some details.
 */

const schema = defineSchema({
  conversations: defineTable({
    members: v.array(v.id("users")),
    summary: v.optional(v.string()),
  }),
  users: defineTable({
    name: v.string(),
  }),
  messages: defineTable({
    conversation: v.id("conversations"),
    author: v.id("users"),
    content: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

declare const OMIT_ME: any;

const api = anyApi;
const internal = anyApi;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

type Doc<T extends keyof DataModel> = DataModel[T]["document"];
type Id<T extends keyof DataModel> = GenericId<T>;

// @snippet start usersWrong
export const getCurrentUser_OMIT_1 = query({
  args: {},
  handler: async (ctx) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new Error("Unauthorized");
    }
    const user = /* query ctx.db to load the user */ OMIT_ME;
    const userSettings = /* load other documents related to the user */ OMIT_ME;
    return { user, settings: userSettings };
  },
});
// @snippet end usersWrong

// @snippet start conversationsWrong
export const listMessages_OMIT_1 = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    const conversation = await ctx.db.get(conversationId);
    if (conversation === null || !conversation.members.includes(user._id)) {
      throw new Error("Unauthorized");
    }
    const messages = /* query ctx.db to load the messages */ OMIT_ME;
    return messages;
  },
});

export const summarizeConversation_OMIT_1 = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(api.conversations.listMessages, {
      conversationId,
    });
    // @skipNextLine
    /* prettier-ignore */
    const summary = /* call some external service to summarize the conversation */ OMIT_ME;
    await ctx.runMutation(api.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsWrong

// @snippet start usersCorrect
export async function getCurrentUser(ctx: QueryCtx) {
  const userIdentity = await ctx.auth.getUserIdentity();
  if (userIdentity === null) {
    throw new Error("Unauthorized");
  }
  const user = /* query ctx.db to load the user */ OMIT_ME;
  const userSettings = /* load other documents related to the user */ OMIT_ME;
  return { user, settings: userSettings };
}
// @snippet end usersCorrect

declare const Users: {
  getCurrentUser: (ctx: QueryCtx) => Promise<Doc<"users">>;
};

// @snippet start conversationsModelCorrect
export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  const user = await Users.getCurrentUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (conversation === null || !conversation.members.includes(user._id)) {
    throw new Error("Unauthorized");
  }
  return conversation;
}

export async function listMessages_OMIT_2(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  await ensureHasAccess(ctx, { conversationId });
  const messages = /* query ctx.db to load the messages */ OMIT_ME;
  return messages;
}

export async function addSummary_OMIT_1(
  ctx: MutationCtx,
  {
    conversationId,
    summary,
  }: { conversationId: Id<"conversations">; summary: string },
) {
  await ensureHasAccess(ctx, { conversationId });
  await ctx.db.patch(conversationId, { summary });
}

export async function generateSummary(
  messages: Doc<"messages">[],
  conversationId: Id<"conversations">,
) {
  // @skipNextLine
  /* prettier-ignore */
  const summary = /* call some external service to summarize the conversation */ OMIT_ME;
  return summary;
}
// @snippet end conversationsModelCorrect

declare const Conversations: {
  addSummary: (
    ctx: MutationCtx,
    {
      conversationId,
      summary,
    }: { conversationId: Id<"conversations">; summary: string },
  ) => Promise<void>;
  listMessages: (
    ctx: QueryCtx,
    { conversationId }: { conversationId: Id<"conversations"> },
  ) => Promise<Doc<"messages">[]>;
  generateSummary: (
    messages: Doc<"messages">[],
    conversationId: Id<"conversations">,
  ) => Promise<string>;
};

// @snippet start conversationsApiCorrect
export const addSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, { conversationId, summary }) => {
    await Conversations.addSummary(ctx, { conversationId, summary });
  },
});

export const listMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    return Conversations.listMessages(ctx, { conversationId });
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(internal.conversations.listMessages, {
      conversationId,
    });
    const summary = await Conversations.generateSummary(
      messages,
      conversationId,
    );
    await ctx.runMutation(internal.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsApiCorrect

```



```ts
import {
  ActionBuilder,
  DataModelFromSchemaDefinition,
  GenericDocument,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
  anyApi,
  defineSchema,
  defineTable,
} from "convex/server";
import { GenericId, v } from "convex/values";
/**
 * See the comment at the top of ./index.ts for more details on the
 * goals of these snippets + some strategies for writing syntactically
 * correct code while glossing over some details.
 */

const schema = defineSchema({
  conversations: defineTable({
    members: v.array(v.id("users")),
    summary: v.optional(v.string()),
  }),
  users: defineTable({
    name: v.string(),
  }),
  messages: defineTable({
    conversation: v.id("conversations"),
    author: v.id("users"),
    content: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

declare const OMIT_ME: any;

const api = anyApi;
const internal = anyApi;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

type Doc<T extends keyof DataModel> = DataModel[T]["document"];
type Id<T extends keyof DataModel> = GenericId<T>;

// @snippet start usersWrong
export const getCurrentUser_OMIT_1 = query({
  args: {},
  handler: async (ctx) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new Error("Unauthorized");
    }
    const user = /* query ctx.db to load the user */ OMIT_ME;
    const userSettings = /* load other documents related to the user */ OMIT_ME;
    return { user, settings: userSettings };
  },
});
// @snippet end usersWrong

// @snippet start conversationsWrong
export const listMessages_OMIT_1 = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    const conversation = await ctx.db.get(conversationId);
    if (conversation === null || !conversation.members.includes(user._id)) {
      throw new Error("Unauthorized");
    }
    const messages = /* query ctx.db to load the messages */ OMIT_ME;
    return messages;
  },
});

export const summarizeConversation_OMIT_1 = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(api.conversations.listMessages, {
      conversationId,
    });
    // @skipNextLine
    /* prettier-ignore */
    const summary = /* call some external service to summarize the conversation */ OMIT_ME;
    await ctx.runMutation(api.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsWrong

// @snippet start usersCorrect
export async function getCurrentUser(ctx: QueryCtx) {
  const userIdentity = await ctx.auth.getUserIdentity();
  if (userIdentity === null) {
    throw new Error("Unauthorized");
  }
  const user = /* query ctx.db to load the user */ OMIT_ME;
  const userSettings = /* load other documents related to the user */ OMIT_ME;
  return { user, settings: userSettings };
}
// @snippet end usersCorrect

declare const Users: {
  getCurrentUser: (ctx: QueryCtx) => Promise<Doc<"users">>;
};

// @snippet start conversationsModelCorrect
export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  const user = await Users.getCurrentUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (conversation === null || !conversation.members.includes(user._id)) {
    throw new Error("Unauthorized");
  }
  return conversation;
}

export async function listMessages_OMIT_2(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  await ensureHasAccess(ctx, { conversationId });
  const messages = /* query ctx.db to load the messages */ OMIT_ME;
  return messages;
}

export async function addSummary_OMIT_1(
  ctx: MutationCtx,
  {
    conversationId,
    summary,
  }: { conversationId: Id<"conversations">; summary: string },
) {
  await ensureHasAccess(ctx, { conversationId });
  await ctx.db.patch(conversationId, { summary });
}

export async function generateSummary(
  messages: Doc<"messages">[],
  conversationId: Id<"conversations">,
) {
  // @skipNextLine
  /* prettier-ignore */
  const summary = /* call some external service to summarize the conversation */ OMIT_ME;
  return summary;
}
// @snippet end conversationsModelCorrect

declare const Conversations: {
  addSummary: (
    ctx: MutationCtx,
    {
      conversationId,
      summary,
    }: { conversationId: Id<"conversations">; summary: string },
  ) => Promise<void>;
  listMessages: (
    ctx: QueryCtx,
    { conversationId }: { conversationId: Id<"conversations"> },
  ) => Promise<Doc<"messages">[]>;
  generateSummary: (
    messages: Doc<"messages">[],
    conversationId: Id<"conversations">,
  ) => Promise<string>;
};

// @snippet start conversationsApiCorrect
export const addSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, { conversationId, summary }) => {
    await Conversations.addSummary(ctx, { conversationId, summary });
  },
});

export const listMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    return Conversations.listMessages(ctx, { conversationId });
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(internal.conversations.listMessages, {
      conversationId,
    });
    const summary = await Conversations.generateSummary(
      messages,
      conversationId,
    );
    await ctx.runMutation(internal.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsApiCorrect

```



```ts
import {
  ActionBuilder,
  DataModelFromSchemaDefinition,
  GenericDocument,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
  anyApi,
  defineSchema,
  defineTable,
} from "convex/server";
import { GenericId, v } from "convex/values";
/**
 * See the comment at the top of ./index.ts for more details on the
 * goals of these snippets + some strategies for writing syntactically
 * correct code while glossing over some details.
 */

const schema = defineSchema({
  conversations: defineTable({
    members: v.array(v.id("users")),
    summary: v.optional(v.string()),
  }),
  users: defineTable({
    name: v.string(),
  }),
  messages: defineTable({
    conversation: v.id("conversations"),
    author: v.id("users"),
    content: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

declare const OMIT_ME: any;

const api = anyApi;
const internal = anyApi;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;

type Doc<T extends keyof DataModel> = DataModel[T]["document"];
type Id<T extends keyof DataModel> = GenericId<T>;

// @snippet start usersWrong
export const getCurrentUser_OMIT_1 = query({
  args: {},
  handler: async (ctx) => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (userIdentity === null) {
      throw new Error("Unauthorized");
    }
    const user = /* query ctx.db to load the user */ OMIT_ME;
    const userSettings = /* load other documents related to the user */ OMIT_ME;
    return { user, settings: userSettings };
  },
});
// @snippet end usersWrong

// @snippet start conversationsWrong
export const listMessages_OMIT_1 = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const user = await ctx.runQuery(api.users.getCurrentUser);
    const conversation = await ctx.db.get(conversationId);
    if (conversation === null || !conversation.members.includes(user._id)) {
      throw new Error("Unauthorized");
    }
    const messages = /* query ctx.db to load the messages */ OMIT_ME;
    return messages;
  },
});

export const summarizeConversation_OMIT_1 = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(api.conversations.listMessages, {
      conversationId,
    });
    // @skipNextLine
    /* prettier-ignore */
    const summary = /* call some external service to summarize the conversation */ OMIT_ME;
    await ctx.runMutation(api.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsWrong

// @snippet start usersCorrect
export async function getCurrentUser(ctx: QueryCtx) {
  const userIdentity = await ctx.auth.getUserIdentity();
  if (userIdentity === null) {
    throw new Error("Unauthorized");
  }
  const user = /* query ctx.db to load the user */ OMIT_ME;
  const userSettings = /* load other documents related to the user */ OMIT_ME;
  return { user, settings: userSettings };
}
// @snippet end usersCorrect

declare const Users: {
  getCurrentUser: (ctx: QueryCtx) => Promise<Doc<"users">>;
};

// @snippet start conversationsModelCorrect
export async function ensureHasAccess(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  const user = await Users.getCurrentUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (conversation === null || !conversation.members.includes(user._id)) {
    throw new Error("Unauthorized");
  }
  return conversation;
}

export async function listMessages_OMIT_2(
  ctx: QueryCtx,
  { conversationId }: { conversationId: Id<"conversations"> },
) {
  await ensureHasAccess(ctx, { conversationId });
  const messages = /* query ctx.db to load the messages */ OMIT_ME;
  return messages;
}

export async function addSummary_OMIT_1(
  ctx: MutationCtx,
  {
    conversationId,
    summary,
  }: { conversationId: Id<"conversations">; summary: string },
) {
  await ensureHasAccess(ctx, { conversationId });
  await ctx.db.patch(conversationId, { summary });
}

export async function generateSummary(
  messages: Doc<"messages">[],
  conversationId: Id<"conversations">,
) {
  // @skipNextLine
  /* prettier-ignore */
  const summary = /* call some external service to summarize the conversation */ OMIT_ME;
  return summary;
}
// @snippet end conversationsModelCorrect

declare const Conversations: {
  addSummary: (
    ctx: MutationCtx,
    {
      conversationId,
      summary,
    }: { conversationId: Id<"conversations">; summary: string },
  ) => Promise<void>;
  listMessages: (
    ctx: QueryCtx,
    { conversationId }: { conversationId: Id<"conversations"> },
  ) => Promise<Doc<"messages">[]>;
  generateSummary: (
    messages: Doc<"messages">[],
    conversationId: Id<"conversations">,
  ) => Promise<string>;
};

// @snippet start conversationsApiCorrect
export const addSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, { conversationId, summary }) => {
    await Conversations.addSummary(ctx, { conversationId, summary });
  },
});

export const listMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    return Conversations.listMessages(ctx, { conversationId });
  },
});

export const summarizeConversation = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.runQuery(internal.conversations.listMessages, {
      conversationId,
    });
    const summary = await Conversations.generateSummary(
      messages,
      conversationId,
    );
    await ctx.runMutation(internal.conversations.addSummary, {
      conversationId,
      summary,
    });
  },
});
// @snippet end conversationsApiCorrect

```


## Use `runAction` only when using a different runtime

### Why?

Calling `runAction` has more overhead than calling a plain TypeScript function.
It counts as an extra function call with its own memory and CPU usage, while the
parent action is doing nothing except waiting for the result. Therefore,
`runAction` should almost always be replaced with calling a plain TypeScript
function. However, if you want to call code that requires Node.js from a
function in the Convex runtime (e.g. using a library that requires Node.js),
then you can use `runAction` to call the Node.js code.

### Example


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```



```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```



```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


### How?

Search for `runAction` in your Convex codebase, and see if the function it calls
uses the same runtime as the parent function. If so, replace the `runAction`
with a plain TypeScript function. You may want to structure your functions so
the Node.js functions are in a separate directory so it's easier to spot these.

## Avoid sequential `ctx.runMutation` / `ctx.runQuery` calls from actions

### Why?

Each `ctx.runMutation` or `ctx.runQuery` runs in its own transaction, which
means if they're called separately, they may not be consistent with each other.
If instead we call a single `ctx.runQuery` or `ctx.runMutation`, we're
guaranteed that the results we get are consistent.

### How?

Audit your calls to `ctx.runQuery` and `ctx.runMutation` in actions. If you see
multiple in a row with no other code between them, replace them with a single
`ctx.runQuery` or `ctx.runMutation` that handles both things. Refactoring your
code to use helper functions will make this easier.

### Example: Queries


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```



```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


### Example: Loops


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```



```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```


### Exceptions

If you're intentionally trying to process more data than fits in a single
transaction, like running a migration or aggregating data, then it makes sense
to have multiple sequential `ctx.runMutation` / `ctx.runQuery` calls.

Multiple `ctx.runQuery` / `ctx.runMutation` calls are often necessary because
the action does a side effect in between them. For example, reading some data,
feeding it to an external service, and then writing the result back to the
database.

## Use `ctx.runQuery` and `ctx.runMutation` sparingly in queries and mutations

### Why?

While these queries and mutations run in the same transaction, and will give
consistent results, they have extra overhead compared to plain TypeScript
functions. Wanting a TypeScript helper function is much more common than needing
`ctx.runQuery` or `ctx.runMutation`.

### How?

Audit your calls to `ctx.runQuery` and `ctx.runMutation` in queries and
mutations. Unless one of the exceptions below applies, replace them with a plain
TypeScript function.

### Exceptions

- If you're using components, these require `ctx.runQuery` or `ctx.runMutation`.
- If you want partial rollback on an error, you will want `ctx.runMutation`
  instead of a plain TypeScript function.


```ts
import { GenericId, v } from "convex/values";
import {
  ActionBuilder,
  anyApi,
  Crons,
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  PaginationOptions,
  QueryBuilder,
} from "convex/server";

/**
 * The snippets in our best practices guide are a little less
 * rigorous than most of our snippets. They're more about illustrating
 * "right" and "wrong" patterns side by side than providing complete
 * code that can be copy-pasted and immediately run.
 *
 * We're more comfortable omitting import statements or glossing over
 * portions of functions in these snippets than elsewhere.
 *
 * However we still want to write these in TypeScript so we write syntactically
 * correct code (it's very easy to make mistakes in markdown).
 *
 * When changing things here, check that the "Best practices" page in
 * docs still looks correct.
 *
 * A few tricks to write syntactically valid code while glossing over details:
 * - Use `declare const` to declare variables we're using without actually needing
 * to give them a value
 * - Use blocks + `// @skipNextLine` to allow using the same `const` name
 * twice for side by side examples within the same snippet
 * - Use `foo_OMIT_1` + `foo_OMIT_2` with the `replacements` option on the
 * snippet to use the same function name twice (especially for exported functions)
 * - Use `/* do X *\/ OMIT_ME` + the `replacements` option on the snippet to
 * avoid writing out details.
 */

const schema = defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
  }).index("by_author", ["author"]),
  movies: defineTable({
    director: v.string(),
  }).index("by_director", ["director"]),
  watchedMovies: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  watchedMoviesCount: defineTable({
    user: v.string(),
  }).index("by_user", ["user"]),
  teamMembers: defineTable({
    team: v.string(),
    user: v.string(),
  })
    .index("by_team", ["team"])
    .index("by_team_and_user", ["team", "user"]),
  teams: defineTable({
    name: v.string(),
    owner: v.string(),
  }),
  failures: defineTable({
    kind: v.string(),
    body: v.string(),
    author: v.string(),
    error: v.string(),
  }),
});
type DataModel = DataModelFromSchemaDefinition<typeof schema>;

type QueryCtx = GenericQueryCtx<DataModel>;
type MutationCtx = GenericMutationCtx<DataModel>;
type ActionCtx = GenericActionCtx<DataModel>;

declare const ctx: QueryCtx;

declare const internalMutation: MutationBuilder<DataModel, "internal">;
declare const internalQuery: QueryBuilder<DataModel, "internal">;
declare const action: ActionBuilder<DataModel, "public">;
declare const mutation: MutationBuilder<DataModel, "public">;

declare const crons: Crons;

const internal = anyApi;
const api = anyApi;

declare const OMIT_ME: any;

// @snippet start filter
// @skipNextLine
{
  // ❌
  const tomsMessages = ctx.db
    .query("messages")
    .filter((q) => q.eq(q.field("author"), "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Option 1: Use an index
  const tomsMessages = await ctx.db
    .query("messages")
    .withIndex("by_author", (q) => q.eq("author", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // Option 2: Filter in code
  const allMessages = await ctx.db.query("messages").collect();
  const tomsMessages = allMessages.filter((m) => m.author === "Tom");
  // @skipNextLine
}
// @snippet end filter

declare const paginationOptions: PaginationOptions;

// @snippet start collectIndex
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const allMovies = await ctx.db.query("movies").collect();
  const moviesByDirector = allMovies.filter(
    (m) => m.director === "Steven Spielberg",
  );
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- small number of results, so `collect` is fine
  const moviesByDirector = await ctx.db
    .query("movies")
    .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
    .collect();
  // @skipNextLine
}
// @snippet end collectIndex

// @snippet start collectPaginate
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- using pagination, showing recently watched movies first
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .order("desc")
    .paginate(paginationOptions);
  // @skipNextLine
}
// @snippet end collectPaginate

// @snippet start collectCount
// @skipNextLine
{
  // ❌ -- potentially unbounded
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .collect();
  const numberOfWatchedMovies = watchedMovies.length;
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Show "99+" instead of needing to load all documents
  const watchedMovies = await ctx.db
    .query("watchedMovies")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .take(100);
  const numberOfWatchedMovies =
    watchedMovies.length === 100 ? "99+" : watchedMovies.length.toString();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅ -- Denormalize the number of watched movies in a separate table
  const watchedMoviesCount = await ctx.db
    .query("watchedMoviesCount")
    .withIndex("by_user", (q) => q.eq("user", "Tom"))
    .unique();
  // @skipNextLine
}
// @snippet end collectCount

declare const teamId: GenericId<"teams">;

// @snippet start redundantIndexes
// @skipNextLine
{
  // ❌
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}

// @skipNextLine
{
  // ✅
  // Just don't include a condition on `user` when querying for results on `team`
  const allTeamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) => q.eq("team", teamId))
    .collect();
  const currentUserId = /* get current user id from `ctx.auth` */ OMIT_ME;
  const currentTeamMember = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("team", teamId).eq("user", currentUserId),
    )
    .unique();
  // @skipNextLine
}
// @snippet end redundantIndexes

// @snippet start validation
// ❌ -- could be used to update any document (not just `messages`)
export const updateMessage_OMIT_1 = mutation({
  handler: async (ctx, { id, update }) => {
    // @skipNextLine
    // @ts-expect-error -- id has type `unknown` here
    await ctx.db.patch(id, update);
  },
});

// ✅ -- can only be called with an ID from the messages table, and can only update
// the `body` and `author` fields
export const updateMessage_OMIT_2 = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});
// @snippet end validation

type TeamMember = {
  email: string;
};
// @snippet start accessControl
// ❌ -- no checks! anyone can update any team if they get the ID
export const updateTeam_OMIT_1 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ❌ -- checks access, but uses `email` which could be spoofed
export const updateTeam_OMIT_2 = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
    email: v.string(),
  },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */ OMIT_ME as TeamMember[];
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- checks access, and uses `ctx.auth`, which cannot be spoofed
export const updateTeam = mutation({
  args: {
    id: v.id("teams"),
    update: v.object({
      name: v.optional(v.string()),
      owner: v.optional(v.id("users")),
    }),
  },
  handler: async (ctx, { id, update }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, update);
  },
});

// ✅ -- separate functions which have different access control
export const setTeamOwner = mutation({
  args: {
    id: v.id("teams"),
    owner: v.id("users"),
  },
  handler: async (ctx, { id, owner }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamOwner = /* check if user is the owner of the team */ OMIT_ME;
    if (!isTeamOwner) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { owner: owner });
  },
});

export const setTeamName = mutation({
  args: {
    id: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    const isTeamMember = /* check if user is a member of the team */ OMIT_ME;
    if (!isTeamMember) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(id, { name: name });
  },
});
// @snippet end accessControl

// @snippet start internal
// ❌ -- using `api`
export const sendMessage_OMIT_1 = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    // add message to the database
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage,
  { author: "System", body: "Share your daily update!" },
);

// ✅ Using `internal`
// REPLACE_WITH_MUTATION_CTX_IMPORT
async function sendMessageHelper(
  ctx: MutationCtx,
  args: { body: string; author: string },
) {
  // add message to the database
}

export const sendMessage_OMIT_2 = mutation({
  args: {
    body: v.string(),
  },
  handler: async (ctx, { body }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) {
      throw new Error("Unauthorized");
    }
    await sendMessageHelper(ctx, { body, author: user.name ?? "Anonymous" });
  },
});

export const sendInternalMessage = internalMutation({
  args: {
    body: v.string(),
    // don't need to worry about `author` being spoofed since this is an internal function
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    await sendMessageHelper(ctx, { body, author });
  },
});

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage,
  { author: "System", body: "Share your daily update!" },
);
// @snippet end internal

// @snippet start runAction
// ❌ -- using `runAction`
export const scrapeWebsite_OMIT_1 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page }),
      ),
    );
  },
});
// @snippet end runAction

// @snippet start scrapeModel
// ✅ -- using a plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string },
) {
  const page = await fetch(url);
  const text = /* parse the page */ OMIT_ME;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}
// @snippet end scrapeModel

declare const Scrape: {
  scrapeSinglePage: (ctx: ActionCtx, { url }: { url: string }) => Promise<void>;
};
// @snippet start scrapeAction
export const scrapeWebsite_OMIT_2 = action({
  args: {
    siteMapUrl: v.string(),
  },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse the site map */ OMIT_ME as string[];
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page })),
    );
  },
});
// @snippet end scrapeAction

declare const assert: (condition: boolean) => void;

// @snippet start runQueryWrong
// ❌ -- this assertion could fail if the team changed between running the two queries
const team = await ctx.runQuery(internal.teams.getTeam, { teamId });
const teamOwner = await ctx.runQuery(internal.teams.getTeamOwner, { teamId });
assert(team.owner === teamOwner._id);
// @snippet end runQueryWrong

declare const Teams: {
  load: (
    ctx: QueryCtx,
    { teamId }: { teamId: GenericId<"teams"> },
  ) => Promise<{ owner: GenericId<"users"> }>;
};
declare const Users: {
  load: (
    ctx: QueryCtx,
    { userId }: { userId: GenericId<"users"> },
  ) => Promise<{ _id: GenericId<"users"> }>;
  insert: (
    ctx: MutationCtx,
    { name, email }: { name: string; email: string },
  ) => Promise<void>;
};

// @snippet start runQueryCorrect
export const sendBillingReminder = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // ✅ -- this will always pass
    const teamAndOwner = await ctx.runQuery(internal.teams.getTeamAndOwner, {
      teamId,
    });
    assert(teamAndOwner.team.owner === teamAndOwner.owner._id);
    // send a billing reminder email to the owner
  },
});

export const getTeamAndOwner = internalQuery({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    const team = await Teams.load(ctx, { teamId });
    const owner = await Users.load(ctx, { userId: team.owner });
    return { team, owner };
  },
});
// @snippet end runQueryCorrect

// Gets members on the team
async function fetchTeamMemberData(teamId: string) {
  return [{ name: "Alice", email: "alice@gmail.com" }];
}
// @snippet start runMutationWrong
export const importTeams_OMIT_1 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ❌ This will run a separate mutation for inserting each user,
    // which means you lose transaction guarantees like atomicity.
    for (const member of teamMembers) {
      await ctx.runMutation(internal.teams.insertUser, member);
    }
  },
});
export const insertUser = internalMutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    await Users.insert(ctx, { name, email });
  },
});
// @snippet end runMutationWrong

// @snippet start runMutationCorrect
export const importTeams_OMIT_2 = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, { teamId }) => {
    // Fetch team members from an external API
    const teamMembers = await fetchTeamMemberData(teamId);

    // ✅ This action runs a single mutation that inserts all users in the same transaction.
    await ctx.runMutation(internal.teams.insertUsers, teamMembers);
  },
});
export const insertUsers = internalMutation({
  args: { users: v.array(v.object({ name: v.string(), email: v.string() })) },
  handler: async (ctx, { users }) => {
    for (const { name, email } of users) {
      await Users.insert(ctx, { name, email });
    }
  },
});
// @snippet end runMutationCorrect

// @snippet start partialRollback
export const trySendMessage = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record the failure, but rollback any writes from `sendMessage`
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
// @snippet end partialRollback

```

