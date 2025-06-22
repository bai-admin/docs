---
title: "Script Tag"
sidebar_position: 100
---

Sometimes you just want to get your data on a web page: no installing packages,
no build steps, no TypeScript. Subscribing to queries deployed to an existing
Convex deployment from a script tag is simple.





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


VS Code doesn't support TypeScript autocompletion in HTML files so for types and
better autocompletion you can split your code out into a script file:


```html
<!doctype html>
<form>
  <input placeholder="type here" />
</form>
<div class="messages"></div>

<script src="https://unpkg.com/convex@1.3.1/dist/browser.bundle.js"></script>
<!--VS Code TypeScript autocompletion doesn't work in HTML files so use a file-->
<script src="./script.js"></script>
```


```js
const CONVEX_URL = "http://localhost:8000";

// These JSDoc type annotations help VS Code find types.
/** @type {import("convex/browser")["ConvexClient"]} */
const ConvexClient = convex.ConvexClient;
const client = new ConvexClient(CONVEX_URL);

/** @type {import("./convex/_generated/api")["api"]} */
const api = convex.anyApi;

client.onUpdate(api.messages.list, {}, (messages) => {
  console.log(messages);
  const container = document.querySelector(".messages");
  container.innerHTML = "";
  for (const message of messages.reverse()) {
    const li = document.createElement("li");
    li.textContent = `${message.author}: ${message.body}`;
    container.appendChild(li);
  }
});

document.querySelector("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const inp = e.target.querySelector("input");
  client.mutation(api.messages.send, {
    body: inp.value,
    author: "me",
  });
  inp.value = "";
});
```


See the [Script Tag Quickstart](/quickstart/script-tag.mdx) for instructions for
setting up a new Convex project.
