---
title: Next.js Pages Quickstart
sidebar_label: Quickstart
hide_table_of_contents: true
slug: "quickstart"
---





Learn how to query data from Convex in a Next.js app using the Pages Router.

Alternatively see the [App Router](/quickstart/nextjs.mdx) version of this
quickstart.

<StepByStep>
  <Step title="Create a React app">
    Create a Next.js app using the `npx create-next-app` command.

    Choose the default option for every prompt (hit Enter).


    ```sh
    npx create-next-app@latest my-app --no-app --js
    ```

  </Step>
  <Step title="Install the Convex client and server library">
    To get started, install the `convex`
    package which provides a convenient interface for working
    with Convex from a React app.

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

    > **⚠ snippet " sampleData " not found**

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
    Add a new file `tasks.js` in the `convex/` folder
    with a query function that loads the data.

    Exporting a query function from this file
    declares an API function named after the file
    and the export name, `api.tasks.get`.

    > **⚠ snippet " tasksJs " not found**

  </Step>

  <Step title="Connect the app to your backend">
    In `pages/_app.js`, create a `ConvexReactClient` and pass it to a `ConvexProvider`
    wrapping your app.

    > **⚠ snippet " app " not found**

  </Step>

  <Step title="Display the data in your app">
    In `pages/index.js`, use the `useQuery` hook to fetch from your `api.tasks.get`
    API function.

    > **⚠ snippet " index " not found**

  </Step>

  <Step title="Start the app">
    Start the app, open [http://localhost:3000](http://localhost:3000) in a browser,
    and see the list of tasks.

    ```sh
    npm run dev
    ```

  </Step>

</StepByStep>
