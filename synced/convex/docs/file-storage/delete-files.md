---
title: "Deleting Files"
sidebar_label: "Delete"
sidebar_position: 4
---


Files stored in Convex can be deleted from
[mutations](/functions/mutation-functions.mdx),
[actions](/functions/actions.mdx), and
[HTTP actions](/functions/http-actions.mdx) via the
[`storage.delete()`](/api/interfaces/server.StorageWriter#delete) function,
which accepts a storage ID.

Storage IDs correspond to documents in the `"_storage"` system table (see
[Metadata](/file-storage/file-metadata.mdx)), so they can be validated using the
`v.id("_storage")`.


```ts
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

export const deleteById = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.delete(args.storageId);
  },
});
```

```ts
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

export const deleteById = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.delete(args.storageId);
  },
});
```

