---
title: Python Quickstart
sidebar_label: Python
description: "Add Convex to a Python project"
hide_table_of_contents: true
sidebar_position: 500
---




Learn how to query data from Convex in a Python app.

<StepByStep>
  <Step title="Create a Python script folder">
    Create a folder for your Python script
    with a virtual environment.

    ```sh
    python3 -m venv my-app/venv
    ```

  </Step>
  <Step title="Install the Convex client and server libraries">
    To get started, install the `convex` npm
    package which enables you to write your
    backend.

    And also install the `convex` Python client
    library and `python-dotenv` for working with `.env` files.

    ```sh
    cd my-app && npm init -y && npm install convex && venv/bin/pip install convex python-dotenv
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
  args: {},
  handler: async ({ db }) => {
    return await db.query("tasks").collect();
  },
});

```


  </Step>

  <Step title="Create a script to load data from Convex">
    In a new file `main.py`, create a `ConvexClient` and use it
    to fetch from your `"tasks:get"` API.
    
    
```py
import os

from convex import ConvexClient
from dotenv import load_dotenv

load_dotenv(".env.local")
CONVEX_URL = os.getenv("CONVEX_URL")
# or you can hardcode your deployment URL instead
# CONVEX_URL = "https://happy-otter-123.convex.cloud"

client = ConvexClient(CONVEX_URL)

print(client.query("tasks:get"))

for tasks in client.subscribe("tasks:get"):
    print(tasks)
    # this loop lasts forever, ctrl-c to exit it

```


  </Step>

  <Step title="Run the script">
      Run the script 
      and see the serialized list of tasks.

      ```sh
      venv/bin/python -m main
      ```

  </Step>

</StepByStep>

See the [docs on PyPI](https://pypi.org/project/convex/) for more details.
