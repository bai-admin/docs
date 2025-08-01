---
title: Script Tag Quickstart
sidebar_label: Script Tag
description: "Add Convex to any website"
hide_table_of_contents: true
sidebar_position: 450
---




Learn how to query data from Convex from script tags in HTML.

<StepByStep>
  <Step title="Create a new npm project">
    Create a new directory for your Convex project.

    ```sh
    mkdir my-project && cd my-project && npm init -y
    ```

  </Step>
  <Step title="Install the Convex client and server library">
    Install the `convex`
    package which provides a convenient interface for working
    with Convex from JavaScript.

    ```sh
    npm install convex
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
    Add a new file `tasks.js` in the `convex/` folder
    with a query function that loads the data.

    Exporting a query function from this file
    declares an API function named after the file
    and the export name, `api.tasks.get`.

    
```js
import { query } from "./_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

```


  </Step>

  <Step title="Copy the deployment URL">
    Open the `.env.local` file and copy the `CONVEX_URL` of your development
    environment for use in the HTML file.

    <></>

  </Step>

  <Step title="Add the script to your webpage">
    In a new file `index.html`, create a `ConvexClient` using
    the URL of your development environment.

    Open this file in a web browser and you'll see it run each time the `tasks`
    table is modified.

    
```html
<!doctype html>
<script src="https://unpkg.com/convex@1.3.1/dist/browser.bundle.js"></script>
<script>
  const CONVEX_URL = "http://localhost:8000";
  const client = new convex.ConvexClient(CONVEX_URL);
  client.onUpdate("messages:list", {}, (messages) =>
    console.log(messages.map((msg) => msg.body)),
  );
</script>

```


  </Step>

</StepByStep>

See the complete [Script Tag documentation](/client/javascript/script-tag.mdx).
