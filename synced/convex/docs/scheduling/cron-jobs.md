---
title: "Cron Jobs"
sidebar_position: 2
description: "Schedule recurring functions in Convex"
---


Convex allows you to schedule functions to run on a recurring basis. For
example, cron jobs can be used to clean up data at a regular interval, send a
reminder email at the same time every month, or schedule a backup every
Saturday.

**Example:**
[Cron Jobs](https://github.com/get-convex/convex-demos/tree/main/cron-jobs)

## Defining your cron jobs

Cron jobs are defined in a `crons.ts` file in your `convex/` directory and look
like:


```ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "clear messages table",
  { minutes: 1 }, // every minute
  internal.messages.clearAll,
);

crons.monthly(
  "payment reminder",
  { day: 1, hourUTC: 16, minuteUTC: 0 }, // Every month on the first day at 8:00am PST
  internal.payments.sendPaymentEmail,
  { email: "my_email@gmail.com" }, // argument to sendPaymentEmail
);

// An alternative way to create the same schedule as above with cron syntax
crons.cron(
  "payment reminder duplicate",
  "0 16 1 * *",
  internal.payments.sendPaymentEmail,
  { email: "my_email@gmail.com" }, // argument to sendPaymentEmail
);

export default crons;

```


The first argument is a unique identifier for the cron job.

The second argument is the schedule at which the function should run, see
[Supported schedules](/scheduling/cron-jobs.mdx#supported-schedules) below.

The third argument is the name of the public function or
[internal function](/functions/internal-functions.mdx), either a
[mutation](/functions/mutation-functions.mdx) or an
[action](/functions/actions.mdx).

## Supported schedules

- [`crons.interval()`](/api/classes/server.Crons#interval) runs a function every
  specified number of `seconds`, `minutes`, or `hours`. The first run occurs
  when the cron job is first deployed to Convex. Unlike traditional crons, this
  option allows you to have seconds-level granularity.
- [`crons.cron()`](/api/classes/server.Crons#cron) the traditional way of
  specifying cron jobs by a string with five fields separated by spaces
  <nobr>(e.g. `"* * * * *"`)</nobr>. Times in cron syntax are in the UTC
  timezone. [Crontab Guru](https://crontab.guru/) is a helpful resource for
  understanding and creating schedules in this format.
- [`crons.hourly()`](/api/classes/server.Crons#cron),
  [`crons.daily()`](/api/classes/server.Crons#daily),
  [`crons.weekly()`](/api/classes/server.Crons#weekly),
  [`crons.monthly()`](/api/classes/server.Crons#monthly) provide an alternative
  syntax for common cron schedules with explicitly named arguments.

## Viewing your cron jobs

You can view all your cron jobs in the
[Convex dashboard cron jobs view](/dashboard/deployments/schedules.md#cron-jobs-ui).
You can view added, updated, and deleted cron jobs in the logs and history view.
Results of previously executed runs of the cron jobs are also available in the
logs view.

## Error handling

Mutations and actions have the same guarantees that are described in
[Error handling](/scheduling/scheduled-functions.mdx#error-handling) for
scheduled functions.

At most one run of each cron job can be executing at any moment. If the function
scheduled by the cron job takes too long to run, following runs of the cron job
may be skipped to avoid execution from falling behind. Skipping a scheduled run
of a cron job due to the previous run still executing logs a message visible in
the logs view of the dashboard.
