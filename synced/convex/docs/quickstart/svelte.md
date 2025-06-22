---
title: Svelte Quickstart
sidebar_label: Svelte
description: "Add Convex to a Svelte project"
hide_table_of_contents: true
sidebar_position: 350
---





Learn how to query data from Convex in a Svelte app.

<StepByStep>
  <Step title="Create a SvelteKit app">
    Create a SvelteKit app using the `npx sv create` command.

    Other sets of options will work with the library but for this quickstart guide:

    - For "Which Svelte app template," choose **"SvelteKit minimal."**
    - For a package manager, choose **"npm."**
    - For "Add type checking with TypeScript," choose **"Yes, using TypeScript syntax."**
    - For "Select additional options," you don't need to enable anything.

    <br></br>

    ```sh
    npx sv@latest create my-app
    ```

  </Step>

  <Step title="Install the Convex client and server library">
    To get started, install the `convex` and `convex-svelte` packages.

    ```sh
    cd my-app && npm install convex convex-svelte
    ```

  </Step>

  <Step title="Customize the convex path">
    SvelteKit doesn't like referencing code outside of source, so customize
    the convex functionsDir to be under `src/`.

    
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
    const tasks = await ctx.db.query("tasks").collect();
    return tasks.map((task) => ({ ...task, assigner: "tom" }));
  },
});
```


  </Step>

  <Step title="Set up Convex">
    Create a new file `src/routes/+layout.svelte` and set up the Convex client there to make it available on every page of your app.

    
```svelte
<script lang="ts">
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';

	const { children } = $props();
	setupConvex(PUBLIC_CONVEX_URL);
</script>

{@render children()}
```


  </Step>

  <Step title="Display the data in your app">
    In `src/routes/+page.svelte` use `useQuery` to subscribe your `api.tasks.get`
    API function.

    
```svelte
<script lang="ts">
	import { useQuery } from 'convex-svelte';
	import { api } from '../convex/_generated/api.js';

	const query = useQuery(api.tasks.get, {});
</script>

{#if query.isLoading}
	Loading...
{:else if query.error}
	failed to load: {query.error.toString()}
{:else}
	<ul>
		{#each query.data as task}
			<li>
				{task.isCompleted ? '☑' : '☐'}
				<span>{task.text}</span>
				<span>assigned by {task.assigner}</span>
			</li>
		{/each}
	</ul>
{/if}
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

See the
[Svelte npm package documentation](https://www.npmjs.com/package/convex-svelte).
