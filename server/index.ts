import app from "./app";

Bun.serve({
  routes: {},
  fetch: app.fetch,
});

console.log("Server is running");
