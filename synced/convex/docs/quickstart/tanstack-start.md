---
title: TanStack Start Quickstart
sidebar_label: TanStack Start
description: "Add Convex to a TanStack Start project"
hide_table_of_contents: true
sidebar_position: 200
---






<Admonition type="caution" title="TanStack Start is in Release Candidate">

[TanStack Start](https://tanstack.com/start/latest) is a new React framework
currently in the Release Candidate stage. You can try it today but there might
still be bug or issues.

</Admonition>

To get setup quickly with Convex and TanStack Start run

<p>
  <b>
    <CodeWithCopyButton text="npm create convex@latest -- -t tanstack-start" />
  </b>
</p>

or follow the guide below.

To use Clerk with Convex and TanStack Start, see the
[TanStack Start + Clerk guide](/client/tanstack/tanstack-start/clerk.mdx)

---

Learn how to query data from Convex in a TanStack Start site.

<StepByStep>
  <Step title="Create a TanStack Start site">

Create a TanStack Start app using the `create-start-app` command:

    ```sh
    npx create-start-app@latest
    ```

</Step>
  <Step title="Install the Convex client and server library">
    To get started with Convex install the `convex` package and a few React Query-related packages.

    ```sh
    npm install convex @convex-dev/react-query @tanstack/react-router-with-query @tanstack/react-query
    ```

  </Step>

  <Step title="Update app/routes/__root.tsx">
    Add a `QueryClient` to the router context to make React Query usable anywhere in the TanStack Start site.

    
```tsx
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { Outlet, Scripts, HeadContent } from "@tanstack/react-router";
import * as React from "react";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

```


  </Step>

  <Step title="Update app/router.tsx">
    Replace the file `app/router.tsx` with these contents.

    This creates a `ConvexClient` and a `ConvexQueryClient` and wires in a `ConvexProvider`.

    
```ts
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
```


  </Step>

  <Step title="Set up a Convex dev deployment">
    Next, run `npx convex dev`. This
    will prompt you to log in with GitHub,
    create a project, and save your production and deployment URLs.

    It will also create a `convex/` folder for you
    to write your backend API functions in. The `dev` command
    will then continue running to sync your functions
    with your dev deployment in the cloud.


    ```sh
    npx convex dev
    ```

  </Step>

  <Step title="Create sample data for your database">
    In a new terminal window, create a `sampleData.jsonl`
    file with some sample data.

    
```json
{"text": "Buy groceries", "isCompleted": true}
{"text": "Go for a swim", "isCompleted": true}
{"text": "Integrate Convex", "isCompleted": false}

```


  </Step>

  <Step title="Add the sample data to your database">
    Now that your project is ready, add a `tasks` table
    with the sample data into your Convex database with
    the `import` command.

    ```
    npx convex import --table tasks sampleData.jsonl
    ```

  </Step>

  <Step title="Expose a database query">
    Add a new file <JSDialectFileName name="tasks.ts" /> in the `convex/` folder
    with a query function that loads the data.

    Exporting a query function from this file
    declares an API function named after the file
    and the export name, `api.tasks.get`.

    
```ts
import { query } from "./_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

```


  </Step>

  <Step title="Display the data in your app">
    Replace the file `app/routes/index.tsx` with these contents.

    The `useSuspenseQuery` hook renders the API function `api.tasks.get`
    query result on the server initially, then it updates live in the browser.

    
```tsx
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(convexQuery(api.tasks.get, {}));

  return (
    <div>
      {data.map(({ _id, text }) => (
        <div key={_id}>{text}</div>
      ))}
    </div>
  );
}

```


  </Step>

  <Step title="Start the app">
    Start the app, open [http://localhost:3000](http://localhost:3000) in a browser,
    and see the list of tasks.

    ```sh
    npm run dev
    ```

  </Step>

</StepByStep>

For more see the
[TanStack Start with Convex](/client/tanstack/tanstack-start/index.mdx) client
documentation page.
