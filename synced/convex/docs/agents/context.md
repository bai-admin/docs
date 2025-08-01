---
title: LLM Context
sidebar_label: "LLM Context"
sidebar_position: 600
description: "Customizing the context provided to the Agent's LLM"
---

By default, the Agent will provide context based on the message history of the
thread. This context is used to generate the next message.

The context can include recent messages, as well as messages found via text and
/or vector search.

You can also use [RAG](./rag.mdx) to add extra context to your prompt.

## Customizing the context

You can customize the context provided to the agent when generating messages
with custom `contextOptions`. These can be set as defaults on the `Agent`, or
provided at the call-site for `generateText` or others.

```ts
const result = await agent.generateText(
  ctx,
  { threadId },
  { prompt },
  {
    // Values shown are the defaults.
    contextOptions: {
      // Whether to exclude tool messages in the context.
      excludeToolMessages: true,
      // How many recent messages to include. These are added after the search
      // messages, and do not count against the search limit.
      recentMessages: 100,
      // Options for searching messages via text and/or vector search.
      searchOptions: {
        limit: 10, // The maximum number of messages to fetch.
        textSearch: false, // Whether to use text search to find messages.
        vectorSearch: false, // Whether to use vector search to find messages.
        // Note, this is after the limit is applied.
        // E.g. this will quadruple the number of messages fetched.
        // (two before, and one after each message found in the search)
        messageRange: { before: 2, after: 1 },
      },
      // Whether to search across other threads for relevant messages.
      // By default, only the current thread is searched.
      searchOtherThreads: false,
    },
  },
);
```

## Search for messages

This is what the agent does automatically, but it can be useful to do manually,
e.g. to find custom context to include.

If you provide a `beforeMessageId`, it will only fetch messages from before that
message.

```ts

const messages: MessageDoc[] = await agent.fetchContextMessages(ctx, {
  threadId,
  messages: [{ role: "user", content: prompt }],
  userId, // Optional, unless `searchOtherThreads` is true.
  contextOptions, // Optional, defaults are used if not provided.
});
```

## Searching other threads

If you set `searchOtherThreads` to `true`, the agent will search across all
threads belonging to the provided `userId`. This can be useful to have multiple
conversations that the Agent can reference.

The search will use a hybrid of text and vector search.

## Passing in messages as context

You can pass in messages as context to the Agent's LLM, for instance to
implement [Retrieval-Augmented Generation](./rag.mdx). The final messages sent
to the LLM will be:

1. The system prompt, if one is provided or the agent has `instructions`
2. The messages found via contextOptions
3. The `messages` argument passed into `generateText` or other function calls.
4. If a `prompt` argument was provided, a final
   `{ role: "user", content: prompt }` message.

This allows you to pass in messages that are not part of the thread history and
will not be saved automatically, but that the LLM will receive as context.

## Manage embeddings manually

The `textEmbedding` argument to the Agent constructor allows you to specify a
text embedding model.

If you set this, the agent will automatically generate embeddings for messages
and use them for vector search.

When you change models or decide to start or stop using embeddings for vector
search, you can manage the embeddings manually.

Generate embeddings for a set of messages.

```ts
const embeddings = await supportAgent.generateEmbeddings([
  { role: "user", content: "What is love?" },
]);
```

Get and update embeddings, e.g. for a migration to a new model.

```ts
const messages = await ctx.runQuery(components.agent.vector.index.paginate, {
  vectorDimension: 1536,
  targetModel: "gpt-4o-mini",
  cursor: null,
  limit: 10,
});
```

Updating the embedding by ID.

```ts
const messages = await ctx.runQuery(components.agent.vector.index.updateBatch, {
  vectors: [{ model: "gpt-4o-mini", vector: embedding, id: msg.embeddingId }],
});
```

Note: If the dimension changes, you need to delete the old and insert the new.

Delete embeddings

```ts
await ctx.runMutation(components.agent.vector.index.deleteBatch, {
  ids: [embeddingId1, embeddingId2],
});
```

Insert embeddings

```ts
const ids = await ctx.runMutation(components.agent.vector.index.insertBatch, {
  vectorDimension: 1536,
  vectors: [
    {
      model: "gpt-4o-mini",
      table: "messages",
      userId: "123",
      threadId: "123",
      vector: embedding,
      // Optional, if you want to update the message with the embeddingId
      messageId: messageId,
    },
  ],
});
```
