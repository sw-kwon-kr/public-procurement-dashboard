import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 5174);
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".csv", "text/csv; charset=utf-16le"],
]);

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  const filePath = join(root, safePath || "index.html");
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": types.get(extname(filePath)) || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`Procurement dashboard: http://localhost:${port}`);
});
