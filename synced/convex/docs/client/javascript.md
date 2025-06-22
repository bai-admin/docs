---
title: "JavaScript"
sidebar_label: "JavaScript"
sidebar_position: 350
---


# Convex JavaScript Clients

Convex applications can be accessed from Node.js or any JavaScript runtime that
implements [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch) or
[`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket). The
reactive [Convex Client](/api/classes/browser.ConvexClient) allows web
applications and long-running Node.js servers to subscribe to updates on Convex
queries, while the [Convex HTTP client](/api/classes/browser.ConvexHttpClient)
is typically used for server-side rendering, migrations, administrative scripts,
and serverless functions to run queries at a single point in time.

If you're using React, see the dedicated
[`ConvexReactClient`](/api/classes/browser.ConvexClient) described in
[React](/client/react.mdx).

## Convex Client

The [`ConvexClient`](/api/classes/browser.ConvexClient) provides subscriptions
to queries in Node.js and any JavaScript environment that supports WebSockets.



> **⚠ snippet " VanillaTS, VanillaJS " not found**

The Convex client is open source and available on
[GitHub](https://github.com/get-convex/convex-js).

See the [Script Tag Quickstart](/quickstart/script-tag.mdx) to get started.

## HTTP client


The [`ConvexHttpClient`](/api/classes/browser.ConvexHttpClient) works in the
browser, Node.js, and any JavaScript environment with `fetch`.

See the [Node.js Quickstart](/quickstart/nodejs.mdx).

> **⚠ snippet " Example, Example " not found**

## Using Convex without generated `convex/_generated/api.js`

If the source code for your Convex function isn't located in the same project or
in the same monorepos you can use the untyped `api` object called `anyApi`.



> **⚠ snippet " StringsTS, StringsJS " not found**
