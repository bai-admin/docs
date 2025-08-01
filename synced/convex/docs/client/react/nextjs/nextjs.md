---
title: "Next.js"
sidebar_label: "Next.js App Router"
sidebar_position: 200
description: "How Convex works in a Next.js app"
---


[Next.js](https://nextjs.org/) is a React web development framework. When used
with Convex, Next.js provides:

- File-system based routing
- Fast refresh in development
- Font and image optimization

and more!

This page covers the App Router variant of Next.js. Alternatively see the
[Pages Router](/client/react/nextjs-pages-router/nextjs-pages-router.mdx)
version of this page.

## Getting started

Follow the [Next.js Quickstart](/quickstart/nextjs.mdx) to add Convex to a new
or existing Next.js project.

## Adding authentication

### Client-side only

The simplest way to add user authentication to your Next.js app is to follow our
React-based authentication guides for [Clerk](/auth/clerk.mdx) or
[Auth0](/auth/auth0.mdx), inside your `app/ConvexClientProvider.tsx` file. For
example this is what the file would look like for Auth0:


```tsx
"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri:
          typeof window === "undefined" ? undefined : window.location.origin,
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <ConvexProviderWithAuth0 client={convex}>
        {children}
      </ConvexProviderWithAuth0>
    </Auth0Provider>
  );
}

```


Custom loading and logged out views can be built with the helper
`Authenticated`, `Unauthenticated` and `AuthLoading` components from
`convex/react`, see the
[Convex Next.js demo](https://github.com/get-convex/convex-demos/tree/main/nextjs-pages-router/pages/_app.tsx)
for an example.

If only some routes of your app require login, the same helpers can be used
directly in page components that do require login instead of being shared
between all pages from `app/ConvexClientProvider.tsx`. Share a single
[ConvexReactClient](/api/classes/react.ConvexReactClient) instance between pages
to avoid needing to reconnect to Convex on client-side page navigation.

### Server and client side

To access user information or load Convex data requiring `ctx.auth` from Server
Components, Server Actions, or Route Handlers you need to use the Next.js
specific SDKs provided by Clerk and Auth0.

Additional `.env.local` configuration is needed for these hybrid SDKs.

#### Clerk

For an example of using Convex and with Next.js 15, run

<p>
  <b>
    <CodeWithCopyButton text="npm create convex@latest -- -t nextjs-clerk" />
  </b>
</p>

Otherwise, follow the
[Clerk Next.js quickstart](https://clerk.com/docs/quickstarts/nextjs), a guide
from Clerk that includes steps for adding `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
and `CLERK_SECRET_KEY` to the .env.local file. In Next.js 15, the
`<ClerkProvider>` component imported from the `@clerk/nextjs` v6 package
functions as both a client and a server context provider so you probably won't
need the `ClerkProvider` from `@clerk/clerk-react`.

#### Auth0

See the
[Auth0 Next.js](https://auth0.com/docs/quickstart/webapp/nextjs/01-login) guide.

#### Other providers

Convex uses JWT identity tokens on the client for live query subscriptions and
running mutations and actions, and on the Next.js backend for running queries,
mutations, and actions in server components and API routes.

Obtain the appropriate OpenID Identity JWT in both locations and you should be
able to use any auth provider. See
[Custom Auth](https://docs.convex.dev/auth/advanced/custom-auth) for more.

## Server rendering (SSR)

Next.js automatically renders both Client and Server Components on the server
during the initial page load.

To keep your UI
[automatically reactive](/functions/query-functions.mdx#caching--reactivity--consistency)
to changes in your Convex database it needs to use Client Components. The
`ConvexReactClient` will maintain a connection to your deployment and will get
updates as data changes and that must happen on the client.

See the dedicated
[Server Rendering](/client/react/nextjs/nextjs-server-rendering.mdx) page for
more details about preloading data for Client Components, fetching data and
authentication in Server Components, and implementing Route Handlers.
