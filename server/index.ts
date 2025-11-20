import app from "./app";

const port = process.env.PORT || 3000;

Bun.serve({
  port: Number(port),
  fetch: app.fetch,
});

console.log(`Server is running on port ${port}`);
