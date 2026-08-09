import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { resolveStaticRequestPath } from "./dev-server-path-policy.mjs";

const root = path.resolve(".");
const port = Number(process.env.PORT || 5187);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const requestPath = resolveStaticRequestPath(root, req.url || "/");
  if (!requestPath.accepted) {
    res.writeHead(requestPath.status);
    res.end(requestPath.status === 403 ? "Forbidden" : "Bad request");
    return;
  }
  const target = requestPath.target;
  const file = fs.existsSync(target) && fs.statSync(target).isDirectory()
    ? path.join(target, "index.html")
    : target;
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Idle Wuxia prototype running at http://127.0.0.1:${port}/`);
});
