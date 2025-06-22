---
title: "Serving Files"
sidebar_label: "Serve"
sidebar_position: 3
---







Files stored in Convex can be served to your users by generating a URL pointing
to a given file.

## Generating file URLs in queries

The simplest way to serve files is to return URLs along with other data required
by your app from [queries](/functions/query-functions.mdx) and
[mutations](/functions/mutation-functions.mdx).

A file URL can be generated from a storage ID by the
[`storage.getUrl`](/api/interfaces/server.StorageReader#geturl) function of the
[`QueryCtx`](/api/interfaces/server.GenericQueryCtx),
[`MutationCtx`](/api/interfaces/server.GenericMutationCtx), or
[`ActionCtx`](/api/interfaces/server.GenericActionCtx) object:


```ts
import { v } from "convex/values";
// @snippet start query
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").collect();
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        // If the message is an "image" its `body` is an `Id<"_storage">`
        ...(message.format === "image"
          ? { url: await ctx.storage.getUrl(message.body) }
          : {}),
      })),
    );
  },
});
// @snippet end query

// @snippet start generateUploadUrl
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
// @snippet end generateUploadUrl

// @snippet start saveStorageId
export const sendImage = mutation({
  args: { storageId: v.id("_storage"), author: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      body: args.storageId,
      author: args.author,
      format: "image",
    });
  },
});
// @snippet end saveStorageId

export const sendMessage = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, args) => {
    const { body, author } = args;
    await ctx.db.insert("messages", { body, author, format: "text" });
  },
});
```

```ts
import { v } from "convex/values";
// @snippet start query
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").collect();
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        // If the message is an "image" its `body` is an `Id<"_storage">`
        ...(message.format === "image"
          ? { url: await ctx.storage.getUrl(message.body) }
          : {}),
      })),
    );
  },
});
// @snippet end query

// @snippet start generateUploadUrl
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
// @snippet end generateUploadUrl

// @snippet start saveStorageId
export const sendImage = mutation({
  args: { storageId: v.id("_storage"), author: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      body: args.storageId,
      author: args.author,
      format: "image",
    });
  },
});
// @snippet end saveStorageId

export const sendMessage = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, args) => {
    const { body, author } = args;
    await ctx.db.insert("messages", { body, author, format: "text" });
  },
});
```


File URLs can be used in `img` elements to render images:


```tsx
import { FormEvent, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const messages = useQuery(api.messages.list) || [];

  const [newMessageText, setNewMessageText] = useState("");
  const sendMessage = useMutation(api.messages.sendMessage);

  const [name] = useState(() => "User " + Math.floor(Math.random() * 10000));
  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (newMessageText) {
      await sendMessage({ body: newMessageText, author: name });
    }
    setNewMessageText("");
  }

  // @snippet start handlers
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendImage = useMutation(api.messages.sendImage);

  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  async function handleSendImage(event: FormEvent) {
    event.preventDefault();

    // Step 1: Get a short-lived upload URL
    const postUrl = await generateUploadUrl();
    // Step 2: POST the file to the URL
    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": selectedImage!.type },
      body: selectedImage,
    });
    const json = await result.json();
    if (!result.ok) {
      throw new Error(`Upload failed: ${JSON.stringify(json)}`);
    }
    const { storageId } = json;
    // Step 3: Save the newly allocated storage id to the database
    await sendImage({ storageId, author: name });

    setSelectedImage(null);
    imageInput.current!.value = "";
  }
  // @snippet end handlers

  return (
    <main>
      <h1>Convex Chat</h1>
      <p className="badge">
        <span>{name}</span>
      </p>
      <ul>
        {messages.map((message) => (
          <li key={message._id}>
            <span>{message.author}:</span>
            {/* @snippet start useImageComponent */}
            {message.format === "image" ? (
              <Image message={message} />
            ) : (
              <span>{message.body}</span>
            )}
            {/* @snippet end useImageComponent */}
            <span>{new Date(message._creationTime).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSendMessage}>
        <input
          value={newMessageText}
          onChange={(event) => setNewMessageText(event.target.value)}
          placeholder="Write a message…"
        />
        <input type="submit" value="Send" disabled={!newMessageText} />
      </form>
      {/* @snippet start formInput */}
      <form onSubmit={handleSendImage}>
        <input
          type="file"
          accept="image/*"
          ref={imageInput}
          onChange={(event) => setSelectedImage(event.target.files![0])}
          className="ms-2 btn btn-primary"
          disabled={selectedImage !== null}
        />
        <input
          type="submit"
          value="Send Image"
          disabled={selectedImage === null}
        />
      </form>
      {/* @snippet end formInput */}
    </main>
  );
}

// @snippet start imageComponent
function Image({ message }: { message: { url: string } }) {
  return <img src={message.url} height="300px" width="auto" />;
}
// @snippet end imageComponent
```

```jsx
// @snippet start fileUpload
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendImage = useMutation(api.messages.sendImage);

  const imageInput = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const [name] = useState(() => "User " + Math.floor(Math.random() * 10000));
  async function handleSendImage(event) {
    event.preventDefault();

    // Step 1: Get a short-lived upload URL
    const postUrl = await generateUploadUrl();
    // Step 2: POST the file to the URL
    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": selectedImage.type },
      body: selectedImage,
    });
    const { storageId } = await result.json();
    // Step 3: Save the newly allocated storage id to the database
    await sendImage({ storageId, author: name });

    setSelectedImage(null);
    imageInput.current.value = "";
  }
  return (
    <form onSubmit={handleSendImage}>
      <input
        type="file"
        accept="image/*"
        ref={imageInput}
        onChange={(event) => setSelectedImage(event.target.files[0])}
        disabled={selectedImage !== null}
      />
      <input
        type="submit"
        value="Send Image"
        disabled={selectedImage === null}
      />
    </form>
  );
}
// @snippet end fileUpload

// @snippet start imageComponent
function Image({ message }) {
  return <img src={message.url} height="300px" width="auto" />;
}
// @snippet end imageComponent
```


In your query you can control who gets access to a file when the URL is
generated. If you need to control access when the file is _served_, you can
define your own file serving HTTP actions instead.

## Serving files from HTTP actions

You can serve files directly from [HTTP actions](/functions/http-actions.mdx).
An HTTP action will need to take some parameter(s) that can be mapped to a
storage ID, or a storage ID itself.

This enables access control at the time the file is served, such as when an
image is displayed on a website. But note that the HTTP actions response size is
[currently limited](/functions/http-actions.mdx#limits) to 20MB. For larger
files you need to use file URLs as described
[above](#generating-file-urls-in-queries).

A file [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) object
can be generated from a storage ID by the
[`storage.get`](/api/interfaces/server.StorageActionWriter#get) function of the
[`ActionCtx`](/api/interfaces/server.GenericActionCtx) object, which can be
returned in a `Response`:


```ts
// @snippet start sendImageStore
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

http.route({
  path: "/sendImage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Step 1: Store the file
    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);

    // Step 2: Save the storage ID to the database via a mutation
    const author = new URL(request.url).searchParams.get("author");
    await ctx.runMutation(api.messages.sendImage, { storageId, author });

    // Step 3: Return a response with the correct CORS headers
    return new Response(null, {
      status: 200,
      // CORS headers
      headers: new Headers({
        // e.g. https://mywebsite.com, configured on your Convex dashboard
        "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN!,
        Vary: "origin",
      }),
    });
  }),
});
// @snippet end sendImageStore

// @snippet start getImage
http.route({
  path: "/getImage",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const { searchParams } = new URL(request.url);
    const storageId = searchParams.get("storageId")! as Id<"_storage">;
    const blob = await ctx.storage.get(storageId);
    if (blob === null) {
      return new Response("Image not found", {
        status: 404,
      });
    }
    return new Response(blob);
  }),
});
// @snippet end getImage

// @snippet start preflight
// Pre-flight request for /sendImage
http.route({
  path: "/sendImage",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    // Make sure the necessary headers are present
    // for this to be a valid pre-flight request
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          // e.g. https://mywebsite.com, configured on your Convex dashboard
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN!,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Digest",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});
// @snippet end preflight

export default http;
```

```ts
// @snippet start sendImageStore
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

http.route({
  path: "/sendImage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Step 1: Store the file
    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);

    // Step 2: Save the storage ID to the database via a mutation
    const author = new URL(request.url).searchParams.get("author");
    await ctx.runMutation(api.messages.sendImage, { storageId, author });

    // Step 3: Return a response with the correct CORS headers
    return new Response(null, {
      status: 200,
      // CORS headers
      headers: new Headers({
        // e.g. https://mywebsite.com, configured on your Convex dashboard
        "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN!,
        Vary: "origin",
      }),
    });
  }),
});
// @snippet end sendImageStore

// @snippet start getImage
http.route({
  path: "/getImage",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const { searchParams } = new URL(request.url);
    const storageId = searchParams.get("storageId")! as Id<"_storage">;
    const blob = await ctx.storage.get(storageId);
    if (blob === null) {
      return new Response("Image not found", {
        status: 404,
      });
    }
    return new Response(blob);
  }),
});
// @snippet end getImage

// @snippet start preflight
// Pre-flight request for /sendImage
http.route({
  path: "/sendImage",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    // Make sure the necessary headers are present
    // for this to be a valid pre-flight request
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          // e.g. https://mywebsite.com, configured on your Convex dashboard
          "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN!,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Digest",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});
// @snippet end preflight

export default http;
```


The URL of such an action can be used directly in `img` elements to render
images:


```tsx
import { FormEvent, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const messages = useQuery(api.messages.list) || [];

  const [newMessageText, setNewMessageText] = useState("");
  const sendMessage = useMutation(api.messages.send);

  const [name] = useState(() => "User " + Math.floor(Math.random() * 10000));
  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (newMessageText) {
      await sendMessage({ body: newMessageText, author: name });
    }
    setNewMessageText("");
  }

  // @snippet start sendImage
  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  async function handleSendImage(event: FormEvent) {
    event.preventDefault();

    // e.g. https://happy-animal-123.convex.site/sendImage?author=User+123
    const sendImageUrl = new URL(`${convexSiteUrl}/sendImage`);
    sendImageUrl.searchParams.set("author", name);

    await fetch(sendImageUrl, {
      method: "POST",
      headers: { "Content-Type": selectedImage!.type },
      body: selectedImage,
    });

    setSelectedImage(null);
    imageInput.current!.value = "";
  }
  // @snippet end sendImage

  return (
    <main>
      <h1>Convex Chat</h1>
      <p className="badge">
        <span>{name}</span>
      </p>
      <ul>
        {messages.map((message) => (
          <li key={message._id}>
            <span>{message.author}:</span>
            {message.format === "image" ? (
              <Image storageId={message.body} />
            ) : (
              <span>{message.body}</span>
            )}
            <span>{new Date(message._creationTime).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSendMessage}>
        <input
          value={newMessageText}
          onChange={(event) => setNewMessageText(event.target.value)}
          placeholder="Write a message…"
        />
        <input type="submit" value="Send" disabled={!newMessageText} />
      </form>
      {/* @snippet start imageForm */}
      <form onSubmit={handleSendImage}>
        <input
          type="file"
          accept="image/*"
          ref={imageInput}
          onChange={(event) => setSelectedImage(event.target.files![0])}
          disabled={selectedImage !== null}
        />
        <input
          type="submit"
          value="Send Image"
          disabled={selectedImage === null}
        />
      </form>
      {/* @snippet end imageForm */}
    </main>
  );
}

// @snippet start getImage
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;

function Image({ storageId }: { storageId: string }) {
  // e.g. https://happy-animal-123.convex.site/getImage?storageId=456
  const getImageUrl = new URL(`${convexSiteUrl}/getImage`);
  getImageUrl.searchParams.set("storageId", storageId);

  return <img src={getImageUrl.href} height="300px" width="auto" />;
}
// @snippet end getImage
```

```jsx
// @snippet start getImage
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;

function Image({ storageId }) {
  // e.g. https://happy-animal-123.convex.site/getImage?storageId=456
  const getImageUrl = new URL(`${convexSiteUrl}/getImage`);
  getImageUrl.searchParams.set("storageId", storageId);

  return <img src={getImageUrl.href} height="300px" width="auto" />;
}
// @snippet end getImage
```

