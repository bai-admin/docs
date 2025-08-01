---
title: "Optimistic Updates"
slug: "optimistic-updates"
hidden: false
sidebar_position: 90
description: "Make your React app more responsive with optimistic UI updates"
---




Even though Convex queries are completely reactive, sometimes you'll want to
update your UI before the mutation changes propagate back to the client. To
accomplish this, you can configure an _optimistic update_ to execute as part of
your mutation.

Optimistic updates are temporary, local changes to your query results which are
used to make your app more responsive. These updates are made by functions
registered on a mutation invocation with the
[`.withOptimisticUpdate`](/api/interfaces/react.ReactMutation#withoptimisticupdate)
configuration option.

Optimistic updates are run when a mutation is initiated, rerun if the local
query results change, and rolled back when a mutation completes.

## Simple example

Here is how an optimistic update could be added to an `increment` mutation in a
simple counter app:


```tsx
import { api } from "../convex/_generated/api";
import { useMutation } from "convex/react";

export function IncrementCounter() {
  const increment = useMutation(api.counter.increment).withOptimisticUpdate(
    (localStore, args) => {
      const { increment } = args;
      const currentValue = localStore.getQuery(api.counter.get);
      if (currentValue !== undefined) {
        localStore.setQuery(api.counter.get, {}, currentValue + increment);
      }
    },
  );

  const incrementCounter = () => {
    increment({ increment: 1 });
  };

  return <button onClick={incrementCounter}>+1</button>;
}

```


Optimistic updates receive a
[`localStore`](/api/interfaces/browser.OptimisticLocalStore), a view of the
Convex client's internal state, followed by the arguments to the mutation.

This optimistic update updates the `api.counter.get` query to be `increment`
higher if it's loaded.

## Complex example

If we want to add an optimistic update to a multi-channel chat app, that might
look like:


```tsx
import { api } from "../convex/_generated/api";
import { useMutation } from "convex/react";
import { Id } from "../convex/_generated/dataModel";

export function MessageSender(props: { channel: Id<"channels"> }) {
  const sendMessage = useMutation(api.messages.send).withOptimisticUpdate(
    (localStore, args) => {
      const { channel, body } = args;
      const existingMessages = localStore.getQuery(api.messages.list, {
        channel,
      });
      // If we've loaded the api.messages.list query, push an optimistic message
      // onto the list.
      if (existingMessages !== undefined) {
        const now = Date.now();
        const newMessage = {
          _id: crypto.randomUUID() as Id<"messages">,
          _creationTime: now,
          channel,
          body,
        };
        localStore.setQuery(api.messages.list, { channel }, [
          ...existingMessages,
          newMessage,
        ]);
      }
    },
  );

  async function handleSendMessage(
    channelId: Id<"channels">,
    newMessageText: string,
  ) {
    await sendMessage({ channel: channelId, body: newMessageText });
  }

  return (
    <button onClick={() => handleSendMessage(props.channel, "Hello world!")}>
      Send message
    </button>
  );
}

```


This optimistic update changes the `api.messages.list` query for the current
channel to include a new message. The newly created message object should match
the structure of the real messages generated by the `api.messages.list` query on
the server.

Because this message includes the client's current time (not the server's), it
will inevitably not match the `api.messages.list` query after the mutation runs.
That's okay! The Convex client will handle rolling back this update after the
mutation completes and the queries are updated. If there are small mistakes in
optimistic updates, the UI will always eventually render the correct values.

Similarly, the update creates a temporary `Id` with
`new Id("messages", crypto.randomUUID())`. This will also be rolled back and
replaced with the true ID once the server assigns it.

Lastly, note that this update creates a new array of messages instead of using
`existingMessages.push(newMessage)`. This is important! Mutating objects inside
of optimistic updates will corrupt the client's internal state and lead to
surprising results. Always create new objects inside of optimistic updates.

## Learning more

To learn more, check out our API documentation:

- [`.withOptimisticUpdate`](/api/interfaces/react.ReactMutation#withoptimisticupdate)
- [`OptimisticUpdate`](/api/modules/browser#optimisticupdate)
- [`OptimisticLocalStore`](/api/interfaces/browser.OptimisticLocalStore)

If you'd like some hands on experience, try adding optimistic updates to the
[tutorial app](https://github.com/get-convex/convex-tutorial)! If you do, you
should notice the app feels snappier — just a little, Convex is pretty fast
already! — but otherwise works the same.

To explore even further, try inserting a mistake into this update! You should
see a flicker as the optimistic update is applied and then rolled back.
