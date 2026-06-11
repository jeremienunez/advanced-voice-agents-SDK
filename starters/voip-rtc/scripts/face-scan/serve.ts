/* Static server for the one-shot face-scan extraction page. */
const root = new URL(".", import.meta.url).pathname;

Bun.serve({
  port: 4799,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(root + (path === "/" ? "extract.html" : path.slice(1)));
    if (!(await file.exists())) return new Response("not found", { status: 404 });
    return new Response(file);
  },
});

console.log(JSON.stringify({ status: "ok", port: 4799, root }));
