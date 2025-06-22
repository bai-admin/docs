---
title: "TanStack Start with Clerk"
slug: "tanstack-start-with-clerk"
sidebar_label: With Clerk
sidebar_position: 10
---



Using Clerk with Convex looks like following the
[Clerk TanStack Quickstart](https://clerk.com/docs/quickstarts/tanstack-start)
and adding Convex like the
[Convex TanStack Quickstart](/quickstart/tanstack-start.mdx) shows. Then to make
Clerk identity tokens available everywhere you might make authenticated calls to
Convex in TanStack Start, you'll want to

1. Get an ID token from Clerk in addition to the `getAuth()` call with
   `const token = await auth.getToken({ template: "convex" })`.
2. Set the token in beforeLoad with
   `ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)` so the token
   will be available in loaders.
3. Add `<ConvexProviderWithClerk>` to the root component to keep refreshing
   Clerk tokens while the app is in use.

Making these changes looks like modifying `app/router.tsx` like this:

> **⚠ snippet " appRouter " not found**

and modifying `app/routes/__root.tsx` like this:

> **⚠ snippet " appRoutesRoot " not found**

Now all queries, mutations and action made with
[TanStack Query](/client/tanstack-query.mdx) will be authenticated by a Clerk
identity token.
