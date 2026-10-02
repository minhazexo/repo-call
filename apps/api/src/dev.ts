/** Local development server: `npm run dev --workspace=apps/api`. */
import { createServer } from "node:http";
import { handleRequest } from "./index.js";

const PORT = Number(process.env.PORT ?? 4000);

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  req.on("end", () => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
      const response = await handleRequest({
        method: req.method ?? "GET",
        path: url.pathname,
        bodyText: Buffer.concat(chunks).toString("utf-8"),
        origin: req.headers.origin as string | undefined,
      });
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);
    })();
  });
});

server.listen(PORT, () => {
  console.log(`RepoCall API listening on http://localhost:${PORT}`);
  console.log(`Health: curl http://localhost:${PORT}/health`);
});
