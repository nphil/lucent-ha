/** The ONE dev server for lucent-ha: http://127.0.0.1:4180/harness.html
 *
 *   node dev/serve.mjs            (started once as the long-lived service `lucent-harness`; nobody else starts a server)
 *
 * Serves dev/ (the page, dist/ bundles, fonts) plus read-only src/ and node_modules/ so the browser's source maps resolve.
 * Every answer carries `cache-control: no-store`, so `node dev/build.mjs` is all it takes to see a change (then reload).
 * Unknown extension-less paths answer with harness.html: the mock panel's own routes (/harness.html/live, a reload on
 * a navigated URL) keep working like a Home Assistant panel URL does. */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEV = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(DEV, "..");
const PORT = Number(process.env.HARNESS_PORT ?? 4180);
const HOST = "127.0.0.1";
/** URL prefix -> directory. The first match wins; `/` (dev/) is last. */
const MOUNTS = [
  ["/src/", join(REPO, "src")],
  ["/node_modules/", join(REPO, "node_modules")],
  ["/", DEV],
];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  // Source maps point at .ts files: the default for .ts is video/mp2t, which browsers refuse to show as text.
  ".ts": "text/plain; charset=utf-8",
};

/** The file a request path maps to, or undefined when it is outside every mount (path traversal) or malformed. */
function locate(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (path.includes("\0")) return undefined;
  for (const [prefix, root] of MOUNTS) {
    if (!path.startsWith(prefix)) continue;
    const file = resolve(root, path.slice(prefix.length));
    if (file === root || file.startsWith(root + sep)) return file;
    return undefined;
  }
  return undefined;
}

/** Size of `file` when it is a regular file, otherwise undefined. */
async function fileSize(file) {
  try {
    const info = await stat(file);
    return info.isFile() ? info.size : undefined;
  } catch {
    return undefined;
  }
}

function send(response, status, headers, body) {
  response.writeHead(status, { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers });
  response.end(body);
}

async function handle(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") return send(response, 405, { allow: "GET, HEAD" }, "Method not allowed");
  let pathname;
  try {
    pathname = new URL(request.url ?? "/", `http://${HOST}`).pathname;
  } catch {
    return send(response, 400, {}, "Bad request");
  }
  if (pathname === "/") pathname = "/harness.html";
  let file = locate(pathname);
  if (!file) return send(response, 403, { "content-type": TYPES[".txt"] }, "Forbidden");
  let size = await fileSize(file);
  // No file and no extension: a route of the mock panel, answered with the page itself.
  if (size === undefined && extname(pathname) === "") {
    file = join(DEV, "harness.html");
    size = await fileSize(file);
  }
  if (size === undefined) {
    console.log(`404 ${pathname}`);
    return send(response, 404, { "content-type": TYPES[".txt"] }, "Not found");
  }
  response.writeHead(200, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "content-length": size,
  });
  if (request.method === "HEAD") return response.end();
  createReadStream(file).on("error", () => response.destroy()).pipe(response);
}

const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    console.error(`500 ${request.url}: ${error.message}`);
    if (response.headersSent) response.destroy();
    else send(response, 500, { "content-type": TYPES[".txt"] }, "Server error");
  });
});

server.listen(PORT, HOST, () => console.log(`lucent-ha dev harness: http://${HOST}:${PORT}/harness.html`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
