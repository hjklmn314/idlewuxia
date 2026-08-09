import path from "node:path";

export function resolveStaticRequestPath(rootDirectory, requestUrl = "/") {
  const root = path.resolve(rootDirectory);
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl || "/", "http://127.0.0.1").pathname);
  } catch {
    return { accepted: false, status: 400, reason: "malformed request path", target: "" };
  }
  const relativeRequestPath = pathname.replace(/^[/\\]+/, "");
  const target = path.resolve(root, relativeRequestPath || "index.html");
  const relativeTarget = path.relative(root, target);
  const escapesRoot = relativeTarget === ".."
    || relativeTarget.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativeTarget);
  if (escapesRoot) return { accepted: false, status: 403, reason: "request path escapes server root", target: "" };
  return { accepted: true, status: 200, reason: "", target };
}
