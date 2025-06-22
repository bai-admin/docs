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


```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// @snippet start send
export const send = mutation({
  args: { body: v.string(), author: v.string() },
  returns: v.null(),
  handler: async (ctx, { body, author }) => {
    const message = { body, author };
    await ctx.db.insert("messages", message);
  },
});
// @snippet end send
```

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";

// @snippet start send
export const send = mutation({
  args: { body: v.string(), author: v.string() },
  returns: v.null(),
  handler: async (ctx, { body, author }) => {
    const message = { body, author };
    await ctx.db.insert("messages", message);
  },
});
// @snippet end send
```



```ts
import { FunctionReference, anyApi } from "convex/server";

export const api: PublicApiType = anyApi as unknown as PublicApiType;

export type PublicApiType = {
  messages: {
    send: FunctionReference<
      "mutation",
      "public",
      { author: string; body: string },
      null
    >;
  };
};
```

```ts
import { FunctionReference, anyApi } from "convex/server";

export const api: PublicApiType = anyApi as unknown as PublicApiType;

export type PublicApiType = {
  messages: {
    send: FunctionReference<
      "mutation",
      "public",
      { author: string; body: string },
      null
    >;
  };
};
```



```tsx
import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
// Note: This file is importing from the file we generated,`api`,
// and not from `../convex/_generated/api`
import { api } from "../api";

export default function App() {
  const [newMessageText, setNewMessageText] = useState("");
  const sendMessage = useMutation(api.messages.send);

  const [name] = useState(() => "User " + Math.floor(Math.random() * 10000));
  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    await sendMessage({ body: newMessageText, author: name });
    setNewMessageText("");
  }
  return (
    <main>
      <h1>Send Messages</h1>
      <form onSubmit={handleSendMessage}>
        <input
          value={newMessageText}
          onChange={(event) => setNewMessageText(event.target.value)}
          placeholder="Write a message…"
        />
        <input type="submit" value="Send" disabled={!newMessageText} />
      </form>
    </main>
  );
}
```

```tsx
import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
// Note: This file is importing from the file we generated,`api`,
// and not from `../convex/_generated/api`
import { api } from "../api";

export default function App() {
  const [newMessageText, setNewMessageText] = useState("");
  const sendMessage = useMutation(api.messages.send);

  const [name] = useState(() => "User " + Math.floor(Math.random() * 10000));
  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    await sendMessage({ body: newMessageText, author: name });
    setNewMessageText("");
  }
  return (
    <main>
      <h1>Send Messages</h1>
      <form onSubmit={handleSendMessage}>
        <input
          value={newMessageText}
          onChange={(event) => setNewMessageText(event.target.value)}
          placeholder="Write a message…"
        />
        <input type="submit" value="Send" disabled={!newMessageText} />
      </form>
    </main>
  );
}
```


## Limits

- Argument and return value validators are not required, but they will enrich
  the types of your TypeScript API. Where validators aren't defined, we default
  to `v.any()` as the validator.
- You cannot call internal functions from outside of your Convex deployment.
