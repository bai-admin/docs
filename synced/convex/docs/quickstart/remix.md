---
title: Remix Quickstart
sidebar_label: Remix
description: "Add Convex to a Remix project"
hide_table_of_contents: true
sidebar_position: 200
---





Learn how to query data from Convex in a Remix app.

<StepByStep>
  <Step title="Create a Remix site">
    Create a Remix site using the `npx create-remix@latest` command.

    <br></br>

    ```sh
    npx create-remix@latest my-remix-app
    ```

  </Step>

  <Step title="Install the Convex library">
    To get started, install the `convex` package.

    ```sh
    cd my-remix-app && npm install convex
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

  <Step title="Wire up the ConvexProvider">
    Modify `app/root.tsx` to set up the Convex client there to make it available on every page of your app.

    
```tsx
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  json,
  useLoaderData,
} from "@remix-run/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useState } from "react";

export async function loader() {
  const CONVEX_URL = process.env["CONVEX_URL"]!;
  return json({ ENV: { CONVEX_URL } });
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { ENV } = useLoaderData<typeof loader>();
  const [convex] = useState(() => new ConvexReactClient(ENV.CONVEX_URL));
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ConvexProvider client={convex}>{children}</ConvexProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
```


  </Step>

  <Step title="Display the data in your app">
    In `app/routes/_index.tsx` use `useQuery` to subscribe your `api.tasks.get`
    API function.

    
```tsx
import type { MetaFunction } from "@remix-run/node";
import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  const tasks = useQuery(api.tasks.get);
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Welcome to Remix</h1>
      {tasks === undefined
        ? "loading..."
        : tasks.map(({ _id, text }) => <div key={_id}>{text}</div>)}
    </div>
  );
}
```


  </Step>

  <Step title="Start the app">
    Start the app, open [http://localhost:5173](http://localhost:5173) in a browser,
    and see the list of tasks.

    ```sh
    npm run dev
    ```

  </Step>

</StepByStep>

Remix uses the React web library. See the complete
[React documentation](/client/react.mdx).
