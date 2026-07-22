Bun.serve({
  port: 4040,
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === '/' ? '/dpu-brasileirao-demo.html' : url.pathname;
    const file = Bun.file(`${import.meta.dir}${path}`);
    return new Response(file);
  }
});

console.log('Bun server running at http://localhost:4040');
