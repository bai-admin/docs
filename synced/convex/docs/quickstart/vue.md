---
title: Vue Quickstart
sidebar_label: Vue
description: "Add Convex to a Vue project"
hide_table_of_contents: true
sidebar_position: 325
---





Learn how to query data from Convex in a Vue app.

This quickstart guide uses a [community-maintained](/client/vue.md) Vue client
for Convex.

<StepByStep>
  <Step title="Create a Vue site">
    Create a Vue site using the `npm create vue@latest my-vue-app` command.

    Convex will work with any set of options but to follow this quickstart most closely choose:
    * Yes to "Add TypeScript?"
    * No to everything else

    <br></br>

    ```sh
    npm create vue@latest my-vue-app
    ```

  </Step>

  <Step title="Install the Convex library">
    To get started, install the `convex` package.

    ```sh
    cd my-vue-app && npm install convex-vue
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
    Add a new file `tasks.ts` in the `convex/` folder
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
    In `src/main.ts` set up the Convex client there to make it available on every page of your app.

    
```ts
import { convexVue } from 'convex-vue'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

app.use(convexVue, {
  url: import.meta.env.VITE_CONVEX_URL,
})

app.mount('#app')
```


  </Step>

  <Step title="Display the data in your app">
    In `src/App.vue` use `useQuery` to subscribe your `api.tasks.get`
    API function.

    
```vue
<script setup lang="ts">
import { useConvexQuery } from "convex-vue";
import { api } from "../convex/_generated/api";

const { data, isPending } = useConvexQuery(api.tasks.get);
</script>

<template>
  <span v-if="isPending"> Loading... </span>
  <ul v-else>
    <li v-for="todo in data">
      {{ todo.text }} {{ todo.isCompleted ? "☑" : "☐" }}
    </li>
  </ul>
</template>

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

See the complete
[Vue npm package documentation](https://www.npmjs.com/package/convex-vue).
