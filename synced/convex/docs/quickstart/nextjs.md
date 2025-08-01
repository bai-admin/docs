---
title: Next.js Quickstart
sidebar_label: Next.js
description: "Add Convex to a Next.js project"
hide_table_of_contents: true
sidebar_position: 200
---










<Admonition type="tip" title="Convex + Next.js">

Convex is an all-in-one backend and database that integrates quickly and easily
with Next.js.

Once you've gotten started, see how to set up
[hosting](/production/hosting/hosting.mdx),
[server rendering](/client/react/nextjs/nextjs-server-rendering.mdx), and
[auth](https://docs.convex.dev/client/react/nextjs/).

</Admonition>

To get setup quickly with Convex and Next.js run

<p>
  <b>
    <CodeWithCopyButton text="npm create convex@latest" />
  </b>
</p>

or follow the guide below.

---

Learn how to query data from Convex in a Next.js app using the App Router
and<LanguageSelector verbose />

Alternatively see the
[Pages Router](/client/react/nextjs-pages-router/quickstart-nextjs-pages-router.mdx)
version of this quickstart.

<StepByStep>
  <Step title="Create a Next.js app">
    Create a Next.js app using the `npx create-next-app` command.

    Choose the default option for every prompt (hit Enter).

    <JSDialectVariants>
      ```sh
      npx create-next-app@latest my-app
      ```

      ```sh
      npx create-next-app@latest my-app --js
      ```
    </JSDialectVariants>

  </Step>
  <Step title="Install the Convex client and server library">
    To get started, install the `convex` package.

    Navigate to your app and install `convex`.


    ```sh
    cd my-app && npm install convex
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
    Use the [`import`](/database/import-export/import) command to add a `tasks` table with the sample data into your Convex database.

    ```
    npx convex import --table tasks sampleData.jsonl
    ```

  </Step>

  <Step title="Expose a database query">
    In the `convex/` folder, add a new file <JSDialectFileName name="tasks.ts" /> with a query function that loads the data.

    Exporting a query function from this file
    declares an API function named after the file
    and the export name: `api.tasks.get`.

    
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

  <Step title="Create a client component for the Convex provider">
    For `<ConvexProvider>` to work on the client, `ConvexReactClient` must be passed to it.

    In the `app/` folder, add a new file <JSDialectFileName name="ConvexClientProvider.tsx" /> with the following code. This creates a client component that wraps `<ConvexProvider>` and passes it the `<ConvexReactClient>`.

    
```tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

```


  </Step>

  <Step title="Wire up the ConvexClientProvider">
    In <JSDialectFileName name="app/layout.tsx" ext="js" />, wrap the children of the `body` element with the `<ConvexClientProvider>`.

    
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

// @snippet start sendMessageHook
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
// @snippet end sendMessageHook

```


  </Step>

  <Step title="Display the data in your app">
    In <JSDialectFileName name="app/page.tsx" ext="js" />, use the `useQuery()` hook to fetch from your `api.tasks.get`
    API function.

    
```tsx
"use client";

import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function Home() {
  const tasks = useQuery(api.tasks.get);
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      {tasks?.map(({ _id, text }) => <div key={_id}>{text}</div>)}
    </main>
  );
}

```


  </Step>

  <Step title="Start the app">
    Run your Next.js development server, open [http://localhost:3000](http://localhost:3000) in a browser,
    and see the list of tasks.

    ```sh
    npm run dev
    ```

  </Step>

</StepByStep>

See the complete [Next.js documentation](/client/react/nextjs/nextjs.mdx).
