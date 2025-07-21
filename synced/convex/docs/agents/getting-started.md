---
title: "Getting Started with Agent"
sidebar_label: "Getting Started"
sidebar_position: 100
description: "Setting up the agent component"
---

To install the agent component, you'll need an existing Convex project. New to
Convex? Go through the [tutorial](https://docs.convex.dev/tutorial/).

Run `npm create convex` or follow any of the
[quickstarts](https://docs.convex.dev/home) to set one up.

## Installation

Install the component package:

```ts
npm install @convex-dev/agent
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the
component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";

const app = defineApp();
app.use(agent);

export default app;
```

Then run `npx convex dev` to generate code for the component. This needs to
successfully run once before you start defining Agents.

## Defining your first Agent

```ts
import { components } from "./_generated/api";
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";

const agent = new Agent(components.agent, {
  name: "My Agent",
  chat: openai.chat("gpt-4o-mini"),
});

export const helloWorld = action({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }) => {
    const userId = await getAuthUserId(ctx);
    const { thread } = await agent.createThread(ctx, { userId });
    const result = await thread.generateText({ prompt });
    return result.text;
  },
});
```

If you get type errors about `components.agent`, ensure you've run
`npx convex dev` to generate code for the component.

That's it! Next check out creating [Threads](./threads.mdx) and
[Messages](./messages.mdx).

### Customizing the agent

The agent by default only needs a `chat` model to be configured. However, for
vector search, you'll need a `textEmbedding` model. A `name` is helpful to
attribute each message to a specific agent. Other options are defaults that can
be over-ridden at each LLM call-site.

```ts
import { tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { Agent, createTool } from "@convex-dev/agent";
import { components } from "./_generated/api";

// Define an agent similarly to the AI SDK
const supportAgent = new Agent(components.agent, {
  // The chat completions model to use for the agent.
  chat: openai.chat("gpt-4o-mini"),
  // The default system prompt if not over-ridden.
  instructions: "You are a helpful assistant.",
  tools: {
    // Convex tool
    myConvexTool: createTool({
      description: "My Convex tool",
      args: z.object({...}),
      // Note: annotate the return type of the handler to avoid type cycles.
      handler: async (ctx, args): Promise<string> => {
        return "Hello, world!";
      },
    }),
    // Standard AI SDK tool
    myTool: tool({ description, parameters, execute: () => {}}),
  },
  // Embedding model to power vector search of message history (RAG).
  textEmbedding: openai.embedding("text-embedding-3-small"),
  // Used for fetching context messages. See https://docs.convex.dev/agents/context
  contextOptions,
  // Used for storing messages. See https://docs.convex.dev/agents/messages
  storageOptions,
  // Used for limiting the number of steps when tool calls are involved.
  // NOTE: if you want tool calls to happen automatically with a single call,
  // you need to set this to something greater than 1 (the default).
  maxSteps: 1,
  // Used for limiting the number of retries when a tool call fails. Default: 3.
  maxRetries: 3,
  // Used for tracking token usage. See https://docs.convex.dev/agents/usage-tracking
  usageHandler: async (ctx, { model, usage }) => {
    // ... log, save usage to your database, etc.
  },
});
```
