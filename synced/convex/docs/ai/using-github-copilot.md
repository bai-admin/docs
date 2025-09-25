---
title: "Using GitHub Copilot with Convex"
sidebar_position: 200
sidebar_label: Using GitHub Copilot
description: "Tips and best practices for using GitHub Copilot with Convex"
slug: "using-github-copilot"
---

[GitHub Copilot](https://github.com/features/copilot), the AI built into VS
Code, makes it easy to write and maintain apps built with Convex. Let's walk
through how to setup GitHub Copilot for the best possible results with Convex.

## Add Convex Instructions

Add the following
[instructions](https://code.visualstudio.com/docs/copilot/copilot-customization#_instruction-files)
file to your `.github/instructions` directory in your project and it will
automatically be included when working with Typescript or Javascript files:

- [convex.instructions.md](https://convex.link/convex_github_copilot_instructions)

![Showing Where to Put GitHub Copilot Instructions](/img/showing-where-to-put-convex-instructions.png)

If you would rather that the instructions file is NOT automatically pulled into
context then open the file in your editor and alter the `applyTo` field at the
top. Read more about instructions files here:
https://code.visualstudio.com/docs/copilot/copilot-customization#_use-instructionsmd-files

We're constantly working on improving the quality of these rules for Convex by
using rigorous evals. You can help by
[contributing to our evals repo](https://github.com/get-convex/convex-evals).

## Setup the Convex MCP Server

The Convex CLI comes with a
[Convex Model Context Protocol](/ai/convex-mcp-server.mdx) (MCP) server built
in. The Convex MCP server gives your AI coding agent access to the your Convex
deployment to query and optimize your project.

To get started with
[MCP in VS Code](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
then create a file in `.vscode/mcp.json` and add the following:

```json
{
  "servers": {
    "convex-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "convex@latest", "mcp", "start"]
    }
  }
}
```

Once this is done it will take a few seconds to start up the MCP server and then
you should see the Convex tool listed in the codelens:

![Convex Tool in Codelens](/img/convex-tool-in-codelens.png)

and in the selection of tools that the model has access to in chat:

![Convex Tool in Chat](/img/convex-tools-in-chat.png)

Now start asking it questions like:

- Evaluate and convex schema and suggest improvements
- What are this app's public endpoints?
- Run the `my_convex_function` query

If you want to use the MCP server globally for all your projects then you can
add it to your user settings, please see these docs for more information:
https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server-to-your-user-settings
