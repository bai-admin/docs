---
title: Node.js Quickstart
sidebar_label: Node.js
description: "Add Convex to a Node.js project"
hide_table_of_contents: true
sidebar_position: 400
---




Learn how to query data from Convex in a Node.js project.

For instructions for subscriptions instead of point-in-time queries and more
project configurations (TypeScript, bundlers, CJS vs ESM) see
[Node.js notes](/client/javascript/node.mdx).

<StepByStep>
  <Step title="Create a new npm project">
    Create a new directory for your Node.js project.

    ```sh
    mkdir my-project && cd my-project && npm init -y && npm pkg set type="module"
    ```

  </Step>
  <Step title="Install the Convex client and server library">
    Install the `convex`
    package which provides a convenient interface for working
    with Convex from JavaScript.

    Also install the `dotenv` library for loading `.env` files.

    ```sh
    npm install convex dotenv
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

  <Step title="Connect the script to your backend">
    In a new file `script.js`, create a `ConvexHttpClient` using
    the URL of your development environment.

    
```js
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env["CONVEX_URL"]);

client.query(api.tasks.get).then(console.log);

```


  </Step>

  <Step title="Run the script">
    Run the script from the same directory and see the list of tasks logged to the terminal.

    ```sh
    node script.js
    ```

  </Step>

</StepByStep>

See the complete [Node.js documentation](/client/javascript/node.mdx).
