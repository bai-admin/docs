---
title: HTTP Actions
sidebar_position: 35
---






HTTP actions allow you to build an HTTP API right in Convex!

HTTP actions take in a
[Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) and return a
[Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) following
the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
HTTP actions can manipulate the request and response directly, and interact with
data in Convex indirectly by running [queries](/functions/query-functions.mdx),
[mutations](/functions/mutation-functions.mdx), and
[actions](/functions/actions.mdx). HTTP actions might be used for receiving
webhooks from external applications or defining a public HTTP API.

HTTP actions are exposed at `https://<your deployment name>.convex.site` (e.g.
`https://happy-animal-123.convex.site`).

**Example:**
[HTTP Actions](https://github.com/get-convex/convex-demos/tree/main/http)

## Defining HTTP actions

HTTP action handlers are defined using the
[`httpAction`](/generated-api/server#httpaction) constructor, similar to the
`action` constructor for normal actions:


```ts
import { httpAction } from "./_generated/server";

export const doSomething = httpAction(async () => {
  // implementation will be here
  return new Response();
});
```

```ts
import { httpAction } from "./_generated/server";

export const doSomething = httpAction(async () => {
  // implementation will be here
  return new Response();
});
```


The first argument to the `handler` is an
[`ActionCtx`](/api/interfaces/server.GenericActionCtx) object, which provides
[`auth`](/api/interfaces/server.Auth),
[`storage`](/api/interfaces/server.StorageActionWriter), and
[`scheduler`](/api/interfaces/server.Scheduler), as well as `runQuery`,
`runMutation`, `runAction`.

The second argument contains the
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) data. HTTP
actions do not support argument validation, as the parsing of arguments from the
incoming Request is left entirely to you.

Here's an example:


```ts
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const postMessage = httpAction(async (ctx, request) => {
  const { author, body } = await request.json();

  await ctx.runMutation(internal.messages.sendOne, {
    body: `Sent via HTTP action: ${body}`,
    author,
  });

  return new Response(null, {
    status: 200,
  });
});
```

```ts
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const postMessage = httpAction(async (ctx, request) => {
  const { author, body } = await request.json();

  await ctx.runMutation(internal.messages.sendOne, {
    body: `Sent via HTTP action: ${body}`,
    author,
  });

  return new Response(null, {
    status: 200,
  });
});
```


<>
  {/* Wrapped in fragment because Prettier pushes the JSDialectFileName on new line */}
  To expose the HTTP Action, export an instance of
  [`HttpRouter`](/api/classes/server.HttpRouter) from the
  <JSDialectFileName name="convex/http.ts" /> file. To create the instance call
  the `httpRouter` function. On the `HttpRouter` you can expose routes using the
  `route` method:
</>


```ts
// @snippet start router
import { httpRouter } from "convex/server";
import { postMessage, getByAuthor, getByAuthorPathSuffix } from "./messages";

const http = httpRouter();

http.route({
  path: "/postMessage",
  method: "POST",
  handler: postMessage,
});

// Define additional routes
http.route({
  path: "/getMessagesByAuthor",
  method: "GET",
  handler: getByAuthor,
});

// Define a route using a path prefix
http.route({
  // Will match /getAuthorMessages/User+123 and /getAuthorMessages/User+234 etc.
  pathPrefix: "/getAuthorMessages/",
  method: "GET",
  handler: getByAuthorPathSuffix,
});

// Convex expects the router to be the default export of `convex/http.js`.
export default http;
// @snippet end router
```

```ts
// @snippet start router
import { httpRouter } from "convex/server";
import { postMessage, getByAuthor, getByAuthorPathSuffix } from "./messages";

const http = httpRouter();

http.route({
  path: "/postMessage",
  method: "POST",
  handler: postMessage,
});

// Define additional routes
http.route({
  path: "/getMessagesByAuthor",
  method: "GET",
  handler: getByAuthor,
});

// Define a route using a path prefix
http.route({
  // Will match /getAuthorMessages/User+123 and /getAuthorMessages/User+234 etc.
  pathPrefix: "/getAuthorMessages/",
  method: "GET",
  handler: getByAuthorPathSuffix,
});

// Convex expects the router to be the default export of `convex/http.js`.
export default http;
// @snippet end router
```


You can now call this action via HTTP and interact with data stored in the
Convex Database. HTTP actions are exposed on
`https://<your deployment name>.convex.site`.

```bash
export DEPLOYMENT_NAME=... # example: "happy-animal-123"
curl -d '{ "author": "User 123", "body": "Hello world" }' \
    -H 'content-type: application/json' "https://$DEPLOYMENT_NAME.convex.site/postMessage"
```

Like other Convex functions, you can view your HTTP actions in the
[Functions view](/dashboard/deployments/functions.md) of
[your dashboard](https://dashboard.convex.dev/) and view logs produced by them
in the [Logs view](/dashboard/deployments/logs.md).

## Limits

HTTP actions run in the same environment as queries and mutations so also do not
have access to Node.js-specific JavaScript APIs. HTTP actions can call
[actions](/functions/actions.mdx), which can run in Node.js.

Like [actions](/functions/actions.mdx#error-handling), HTTP actions may have
side-effects and will not be automatically retried by Convex when errors occur.
It is a responsibility of the caller to handle errors and retry the request if
appropriate.

Request and response size is limited to 20MB.

HTTP actions support request and response body types of `.text()`, `.json()`,
`.blob()`, and `.arrayBuffer()`.

Note that you don't need to define an HTTP action to call your queries,
mutations and actions over HTTP if you control the caller, since you can use use
the JavaScript [`ConvexHttpClient`](/api/classes/browser.ConvexHttpClient) or
the [Python client](/client/python.md) to call these functions directly.

## Debugging

### Step 1: Check that your HTTP actions were deployed.

Check the [functions page](https://dashboard.convex.dev/deployment/functions) in
the dashboard and make sure there's an entry called `http`.

If not, double check that you've defined your HTTP actions with the `httpRouter`
in a file called `http.js` or `http.ts` (the name of the file must match
exactly), and that `npx convex dev` has no errors.

### Step 2: Check that you can access your endpoint using curl

Get your URL from the dashboard under
[Settings](https://dashboard.convex.dev/deployment/settings) > URL and Deploy
Key.

Make sure this is the URL that ends in **`.convex.site`**, and not
`.convex.cloud`. E.g. `https://happy-animal-123.convex.site`

Run a `curl` command to hit one of your defined endpoints, potentially defining
a new endpoint specifically for testing

```
curl -X GET https://<deployment name>.convex.site/myEndpoint
```

Check the [logs page](https://dashboard.convex.dev/deployment/logs) in the
dashboard to confirm that there's an entry for your HTTP action.

### Step 3: Check the request being made by your browser

If you've determined that your HTTP actions have been deployed and are
accessible via curl, but there are still issues requesting them from your app,
check the exact requests being made by your browser.

Open the _Network_ tab in your browser's developer tools, and trigger your HTTP
requests.

Check that this URL matches what you tested earlier with curl -- it ends in
`.convex.site` and has the right deployment name.

You should be able to see these requests in the dashboard
[logs page](https://dashboard.convex.dev/deployment/logs).

If you see "CORS error" or messages in the browser console like
`Access to fetch at '...' from origin '...' has been blocked by CORS policy`,
you likely need to configure CORS headers and potentially add a handler for the
pre-flight `OPTIONS` request. See
[this section](/functions/http-actions.mdx#cors) below.

## Common patterns

### File Storage

HTTP actions can be used to handle uploading and fetching stored files, see:

- [Uploading files via an HTTP action](/file-storage/upload-files.mdx#uploading-files-via-an-http-action)
- [Serving files from HTTP actions](/file-storage/serve-files.mdx#serving-files-from-http-actions)

### CORS

To make requests to HTTP actions from a website you need to add
[Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
headers to your HTTP actions.

There are existing resources for exactly which CORS headers are required based
on the use case. [This site](https://httptoolkit.com/will-it-cors/) provides an
interactive walkthrough for what CORS headers to add. Here's an example of
adding CORS headers to a Convex HTTP action:


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


Here's an example of handling a pre-flight `OPTIONS` request:


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


### Authentication

You can leverage Convex's built-in [authentication](/auth.mdx) integration and
access a user identity from
[`ctx.auth.getUserIdentity()`](/api/interfaces/server.Auth#getuseridentity). To
do this call your endpoint with an `Authorization` header including a JWT token:


```ts
const jwtToken = "...";

fetch("https://<deployment name>.convex.site/myAction", {
  headers: {
    Authorization: `Bearer ${jwtToken}`,
  },
});
```

```ts
const jwtToken = "...";

fetch("https://<deployment name>.convex.site/myAction", {
  headers: {
    Authorization: `Bearer ${jwtToken}`,
  },
});
```

