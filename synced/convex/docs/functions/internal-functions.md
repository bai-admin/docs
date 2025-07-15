---
title: Internal Functions
sidebar_position: 40
description: "Functions that can only be called by other Convex functions"
---





Internal functions can only be called by other [functions](/functions.mdx) and
cannot be called directly from a [Convex client](/client/react.mdx).

By default your Convex functions are public and accessible to clients. Public
functions may be called by malicious users in ways that cause surprising
results. Internal functions help you mitigate this risk. We recommend using
internal functions any time you're writing logic that should not be called from
a client.

While internal functions help mitigate risk by reducing the public surface area
of your application, you can still validate internal invariants using
[argument validation](/functions/validation.mdx) and/or
[authentication](/auth/functions-auth.mdx).

## Use cases for internal functions

Leverage internal functions by:

- Calling them from [actions](/functions/actions.mdx#action-context) via
  `runQuery` and `runMutation`
- Calling them from [HTTP actions](/functions/http-actions.mdx) via `runQuery`,
  `runMutation`, and `runAction`
- [Scheduling](/scheduling/scheduled-functions.mdx) them from other functions to
  run in the future
- Scheduling them to run periodically from
  [cron jobs](/scheduling/cron-jobs.mdx)
- Running them using the
  [Dashboard](/dashboard/deployments/functions.md#running-functions)
- Running them from the [CLI](/cli.md#run-convex-functions)

## Defining internal functions

An internal function is defined using `internalQuery`, `internalMutation`, or
`internalAction`. For example:


```ts
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const markPlanAsProfessional = internalMutation({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.planId, { planType: "professional" });
  },
});

```


If you need to pass complicated objects to internal functions you might prefer
to not use argument validation. Note though that if you're using `internalQuery`
or `internalMutation` it's a better idea to pass around document IDs instead of
documents, to ensure the query or mutation is working with the up-to-date state
of the database.

<Details summary="Internal function without argument validation">


```ts
import { internalAction } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export const markPlanAsProfessional = internalAction({
  handler: async (actionCtx, args) => {
    // perform an action, perhaps calling a third-party API
  },
});

```


</Details>

## Calling internal functions

Internal functions can be called from actions and scheduled from actions and
mutation using the [`internal`](/generated-api/api#internal) object.

For example, consider this public `upgrade` action that calls the internal
`plans.markPlanAsProfessional` mutation we defined above:


```ts
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const upgrade = action({
  args: {
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    // Call out to payment provider (e.g. Stripe) to charge customer
    const response = await fetch("https://...");
    if (response.ok) {
      // Mark the plan as "professional" in the Convex DB
      await ctx.runMutation(internal.plans.markPlanAsProfessional, {
        planId: args.planId,
      });
    }
  },
});

```


In this example a user should not be able to directly call
`internal.plans.markPlanAsProfessional` without going through the `upgrade`
action — if they did, then they would get a free upgrade.

You can define public and internal functions in the same file.
