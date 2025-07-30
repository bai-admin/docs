---
title: "Custom JWT Provider"
sidebar_label: "Custom JWT Provider"
sidebar_position: 4
description:
  "Configure Convex to work with custom JWT providers that don't implement full
  OIDC protocol, including setup and client-side integration."
---

**Note: This is an advanced feature!** We recommend sticking with the
[supported third-party authentication providers](/auth.mdx).

A [JWT](https://en.wikipedia.org/wiki/JSON_Web_Token) is a string combining
three base64-encoded JSON objects containing claims about who a user is valid
for a limited period of time like an hour. You can create them with a library
like [jose](https://github.com/panva/jose) after receiving some evidence
(typically a cookie) of a user's identity or get them from a third party
authentication service like [Clerk](https://clerk.com). The information in a JWT
is signed (the Convex deployment can tell the information is really from the
issuer and hasn't been modified) but generally not encrypted (you can read it by
base64-decoding the token or pasting it into [jwt.io](https://jwt.io/).

If the JWTs issued to your users by an authentication service contain the right
fields to implement the OpenID Connect (OIDC) protocol, the easiest way to
configure accepting these JWTs is adding an
[OIDC Provider](/auth/advanced/custom-auth) entry in `convex/auth.config.ts`. If
the authentication service or library you're using to issue JWTs doesn't support
these fields (for example [OpenAuth](https://openauth.js.org/) JWTs missing an
`aud` field because they implement the OAuth 2.0 spec but not OIDC) you'll need
to configure a Custom JWT provider in the `convex/auth.config.ts` file.

Custom JWTs are required only to have header fields `kid`, `alg` and `typ`, and
payload fields `sub`, `iss`, and `exp`. An `iat` field is also expected by
Convex clients to implement token refreshing.

## Server-side integration

Use `type: "customJwt"` to configure a Custom JWT auth provider:

```js noDialect title="convex/auth.config.js"
export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "your-application-id",
      issuer: "https://your.issuer.url.com",
      jwks: "https://your.issuer.url.com/.well-known/jwks.json",
      algorithm: "RS256",
    },
  ],
};
```

- `applicationID`: Convex will verify that JWTs have this value in the `aud`
  claim. See below for important information regarding leaving this field out.
  The applicationID field is not required, but necessary to use with many
  authentication providers for security. Read more below before omitting it.
- `issuer`: The issuer URL of the JWT.
- `jwks`: The URL for fetching the JWKS (JSON Web Key Set) from the auth
  provider. If you'd like to avoid hitting an external service you may use a
  data URI, e.g. `"data:text/plain;charset=utf-8;base64,ey..."`
- `algorithm`: The algorithm used to sign the JWT. Only RS256 and ES256 are
  currently supported. See
  [RFC 7518](https://datatracker.ietf.org/doc/html/rfc7518#section-3.1) for more
  details.

The `issuer` property must exactly match the `iss` field of the JWT used and if
specified the `applicationID` property must exactly match the `aud` field. If
your JWT doesn't match, use a tool like [jwt.io](https://jwt.io/) to view an JWT
and confirm these fields match exactly.

### Warning: omitting `applicationID` is often insecure

Leaving out `applicationID` from an auth configuration means the `aud`
(audience) field of your users' JWTs will not be verified. In many cases this is
insecure because a JWT intended for another service can be used to impersonate
them in your service.

Say a user has accounts with `https://todos.com` and `https://banking.com`, two
services which use the same third-party authentication service,
`accounts.google.com`. A JWT accepted by todos.com could be reused to
authenticate with banking.com by either todos.com or an attacker that obtained
access to that JWT.

The `aud` (audience) field of the JWT prevents this: if the JWT was generated
for a specific audience of `https://todos.com` then banking.com can enforce the
`aud` field and know not to accept it.

If the JWTs issued to your users have an `iss` (issuer) URL like
`https://accounts.google.com` that is not specific to your application, it is
not secure to trust these tokens without an ApplicationID because that JWT could
have been collected by a malicious application.

If the JWTs issued to your users have a more specific `iss` field like
`https://api.3rd-party-auth.com/client_0123...` then it may be secure to use no
`aud` field if you control all the services the issuer url grants then access to
and intend for access to any one of these services to grants access to all of
them.

### Custom claims

In addition to top-level fields like `subject`, `issuer`, and `tokenIdentifier`,
subfields of the nested fields of the JWT will be accessible in the auth data
returned from `const authInfo = await ctx.auth.getUserIdentity()` like
`authInfo["properties.id"]` and `authInfo["properties.favoriteColor"]` for a JWT
structured like this:

```json
{
  "properties": {
    "id": "123",
    "favoriteColor": "red"
  },
  "iss": "http://localhost:3000",
  "sub": "user:8fa2be73c2229e85",
  "exp": 1750968478
}
```

## Client-side integration

Your users' browsers need a way to obtain an initial JWT and to request updated
JWTs, ideally before the previous one expires.

See the instructions for
[Custom OIDC Providers](/auth/advanced/custom-auth#client-side-integration) for
how to do this.
