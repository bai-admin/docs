---
title: Multiple Repositories
sidebar_label: Multiple Repositories
description: "Use Convex in multiple repositories"
sidebar_position: 180
---




Your TypeScript clients can call Convex functions in a type-safe way outside of
the repository where your Convex functions are defined. By following the steps
below, you can generate a file similar to `convex/_generated/api.d.ts` that you
can check in and use in a separate repository.

<BetaAdmonition feature="TypeScript API generation" verb="is" />

<StepByStep>
  <Step title="Install the Convex Helpers npm package">
    Install the `convex-helpers` package, which contains a CLI command to generate an api file.

    ```sh
    npm install convex-helpers
    ```

  </Step>
  <Step title="Run a command to generate a TypeScript API file">
    Running this command will call into your configured Convex deployment and generate an `api.ts` file based
    on it. You can see additional flags by passing `--help` to the command.

    ```sh
    npx convex-helpers ts-api-spec
    ```

  </Step>
</StepByStep>

## Example

Below are code snippets of what this workflow looks like in action. These
snippets include three different files:

- `convex/messages.ts` - contains Convex function definitions
- `api.ts` - a generated file from running the command above
- `src/App.tsx` - frontend code in a separate repository where `api.ts` is
  checked in

> **⚠ snippet " Functions, Functions " not found**

> **⚠ snippet " API, API " not found**

> **⚠ snippet " Frontend, Frontend " not found**

## Limits

- Argument and return value validators are not required, but they will enrich
  the types of your TypeScript API. Where validators aren't defined, we default
  to `v.any()` as the validator.
- You cannot call internal functions from outside of your Convex deployment.
