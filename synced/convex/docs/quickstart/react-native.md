---
title: React Native Quickstart
sidebar_label: React Native
description: "Add Convex to a React Native Expo project"
hide_table_of_contents: true
sidebar_position: 300
---





Learn how to query data from Convex in a React Native app.

<StepByStep>
  <Step title="Create a React Native app">
    Create a React Native app using the `npx create-expo-app` command.

    ```sh
    npx create-expo-app my-app
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
    Create a `sampleData.jsonl`
    file with some sample data.

    > **⚠ snippet “sampleData” not found**

  </Step>

  <Step title="Add the sample data to your database">
    Now that your project is ready, add a `tasks` table with the sample data into
    your Convex database with the `import` command.

    ```
    npx convex import --table tasks sampleData.jsonl
    ```

  </Step>

  <Step title="Expose a database query">
    Add a new file `tasks.ts` in the `convex/` folder
    with a query function that loads the data.

    Exporting a query function from this file
    declares an API function named after the file
    and the export name, `api.tasks.get`.

    > **⚠ snippet “tasks” not found**

  </Step>

  <Step title="Reset the Expo project">
    If you haven't done so yet, reset the Expo project to get a fresh
    `app` directory.

    ```
    npm run reset-project
    ```

  </Step>

  <Step title="Connect the app to your backend">
    In `_layout.tsx`, create a `ConvexReactClient` and pass it to a `ConvexProvider`
    wrapping your component tree.

    > **⚠ snippet “layout” not found**

  </Step>

  <Step title="Display the data in your app">
    In `index.tsx` use the `useQuery` hook to fetch
    from your `api.tasks.get` API.

    > **⚠ snippet “index” not found**

  </Step>

  <Step title="Start the app">
    Start the app, scan the provided QR code with your phone,
    and see the serialized list of tasks in the center of the screen.

    ```sh
    npm start
    ```

  </Step>
</StepByStep>

React native uses the same library as React web. See the complete
[React documentation](/client/react.mdx).
