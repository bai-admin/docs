---
title: Rust Quickstart
sidebar_label: Rust
description: "Add Convex to a Rust project"
hide_table_of_contents: true
sidebar_position: 700
---




Learn how to query data from Convex in a Rust app with Tokio.

<StepByStep>
  <Step title="Create a Cargo project">
    Create a new Cargo project.

    ```sh
    cargo new my_app
    cd my_app
    ```

  </Step>
  <Step title="Install the Convex client and server libraries">
    To get started, install the `convex` npm
    package which enables you to write your
    backend.

    And also install the `convex` Rust client library,
    the `tokio` runtime, and `dotenvy` for working with `.env` files.

    ```sh
    npm init -y && npm install convex && cargo add convex tokio dotenvy
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
    and the export name, `"tasks:get"`.

    
```js
import { query } from "./_generated/server";

export const get = query({
  handler: async ({ db }) => {
    return await db.query("tasks").collect();
  },
});

```


  </Step>

  <Step title="Connect the app to your backend">
    In the file `src/main.rs`, create a `ConvexClient` and use it
    to fetch from your `"tasks:get"` API.
    
    
```rs
use std::{
    collections::BTreeMap,
    env,
};

use convex::ConvexClient;

#[tokio::main]
async fn main() {
    dotenvy::from_filename(".env.local").ok();
    dotenvy::dotenv().ok();

    let deployment_url = env::var("CONVEX_URL").unwrap();

    let mut client = ConvexClient::new(&deployment_url).await.unwrap();
    let result = client.query("tasks:get", BTreeMap::new()).await.unwrap();
    println!("{result:#?}");
}

```


  </Step>

  <Step title="Run the app">
      Run the app and see the serialized list of tasks.

      ```sh
      cargo run
      ```

  </Step>

</StepByStep>

See the complete [Rust documentation](https://docs.rs/convex/latest/convex/).
