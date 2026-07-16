import crypto from "node:crypto";

function normalizePath(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function uniqueSorted(values) {
  return [...new Set(values.map(normalizePath).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en"));
}

function classifyPath(file, categories) {
  for (const category of categories || []) {
    if ((category.exact || []).map(normalizePath).includes(file)) return category.id;
    if ((category.prefixes || []).map(normalizePath).some((prefix) => file.startsWith(prefix))) return category.id;
    if (
      !file.includes("/") &&
      (category.rootExtensions || []).some((extension) => file.toLowerCase().endsWith(extension.toLowerCase()))
    ) {
      return category.id;
    }
  }
  return "unknown";
}

function finding(code, subject, message) {
  return { severity: "P0", code, subject, message };
}

function bufferFrom(fileSystem, file) {
  const value = fileSystem.readFile(file);
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

function parseModuleScripts(html) {
  return [...html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/gi)].map((match) =>
    normalizePath(match[1]),
  );
}

export function evaluateProjectBaseline({
  fileSystem,
  scope,
  contract,
  trackedFiles,
  untrackedFiles = [],
  gitState = {},
  requireClean = false,
  requireUpstream = false,
}) {
  const tracked = uniqueSorted(trackedFiles);
  const untracked = uniqueSorted(untrackedFiles);
  const trackedSet = new Set(tracked);
  const findings = [];
  const requiredFiles = uniqueSorted([
    scope.htmlEntry,
    scope.activeEntry,
    ...(scope.activeRuntimeFiles || []),
    ...(scope.activeConfigFiles || []),
    ...(scope.shippingFiles || []),
  ]);

  for (const file of requiredFiles) {
    if (!trackedSet.has(file) || !fileSystem.exists(file)) {
      findings.push(finding("MISSING_REQUIRED_FILE", file, "Required scoped file is not tracked or is missing."));
    }
  }

  const forbiddenRoots = (scope.forbiddenTrackedRoots || []).map(normalizePath);
  const manifest = [];
  for (const file of tracked) {
    const forbiddenRoot = forbiddenRoots.find((root) => file === root.replace(/\/$/, "") || file.startsWith(root));
    if (forbiddenRoot) {
      findings.push(finding("FORBIDDEN_TRACKED_PATH", file, `Tracked path is inside forbidden root ${forbiddenRoot}.`));
    }

    const category = classifyPath(file, scope.trackedCategories);
    if (category === "unknown" && scope.unknownTrackedPathPolicy === "reject") {
      findings.push(finding("UNKNOWN_TRACKED_PATH", file, "Tracked path has no declared scope category."));
    }
    if (!fileSystem.exists(file)) {
      findings.push(finding("MISSING_REQUIRED_FILE", file, "Git reports a tracked file that is missing from the worktree."));
      continue;
    }

    const bytes = bufferFrom(fileSystem, file);
    if (bytes.byteLength > contract.maxTrackedFileBytes) {
      findings.push(
        finding(
          "TRACKED_FILE_TOO_LARGE",
          file,
          `Tracked file is ${bytes.byteLength} bytes; limit is ${contract.maxTrackedFileBytes}.`,
        ),
      );
    }
    manifest.push({
      path: file,
      category,
      bytes: bytes.byteLength,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
  }

  for (const file of untracked) {
    findings.push(finding("UNTRACKED_NONIGNORED_FILE", file, "Non-ignored untracked file is outside the declared baseline."));
  }

  if (fileSystem.exists(scope.htmlEntry)) {
    const html = bufferFrom(fileSystem, scope.htmlEntry).toString("utf8").replace(/^\uFEFF/, "");
    const moduleScripts = parseModuleScripts(html);
    if (moduleScripts.length !== 1 || moduleScripts[0] !== normalizePath(scope.activeEntry)) {
      findings.push(
        finding(
          "INVALID_HTML_ENTRY",
          scope.htmlEntry,
          `Expected exactly one module entry ${scope.activeEntry}; found ${moduleScripts.join(", ") || "none"}.`,
        ),
      );
    }
  }

  const activeRuntimeText = (scope.activeRuntimeFiles || [])
    .filter((file) => fileSystem.exists(file))
    .filter((file) => /\.(?:html|js|mjs|ts|css)$/i.test(file))
    .map((file) => bufferFrom(fileSystem, file).toString("utf8"))
    .join("\n");

  for (const file of scope.activeConfigFiles || []) {
    if (!activeRuntimeText.includes(normalizePath(file))) {
      findings.push(
        finding("MISSING_ACTIVE_CONFIG_REFERENCE", file, "Active runtime does not reference the declared runtime configuration."),
      );
    }
  }

  for (const file of scope.developmentReferenceFiles || []) {
    const normalized = normalizePath(file);
    if (activeRuntimeText.includes(normalized)) {
      findings.push(
        finding(
          "DEVELOPMENT_REFERENCE_IN_ACTIVE_RUNTIME",
          normalized,
          "Development evidence is referenced by the shipping runtime closure.",
        ),
      );
    }
    if ((scope.shippingFiles || []).map(normalizePath).includes(normalized)) {
      findings.push(
        finding("DEVELOPMENT_REFERENCE_IN_SHIPPING_SET", normalized, "Development evidence is present in shippingFiles."),
      );
    }
  }

  if (gitState.available === false) {
    findings.push(finding("GIT_STATE_UNAVAILABLE", "git", "Git state could not be read; no baseline conclusion is allowed."));
  }

  if (requireClean && gitState.dirty) {
    findings.push(finding("DIRTY_WORKTREE", "git", "Release baseline requires a clean worktree."));
  }
  if (
    requireUpstream &&
    contract.releaseGate?.requireHeadEqualsUpstreamWhenConfigured &&
    gitState.upstreamConfigured &&
    gitState.head &&
    gitState.upstreamHead &&
    gitState.head !== gitState.upstreamHead
  ) {
    findings.push(finding("UPSTREAM_DIVERGED", "git", "HEAD does not equal the configured upstream branch."));
  }

  manifest.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const digestInput = manifest.map((row) => `${row.path}\0${row.category}\0${row.bytes}\0${row.sha256}`).join("\n");
  const baselineDigest = crypto.createHash("sha256").update(digestInput).digest("hex");
  const fatalCodes = new Set(contract.fatalFindingCodes || []);
  const fatalFindings = findings.filter((row) => fatalCodes.has(row.code));

  return {
    schema: "idlewuxia.project_baseline_result.v1",
    projectId: scope.projectId,
    pass: fatalFindings.length === 0,
    baselineDigest,
    trackedFileCount: tracked.length,
    untrackedFileCount: untracked.length,
    shippingFileCount: (scope.shippingFiles || []).length,
    gitState,
    manifest,
    findings,
  };
}

export function createMemoryFileSystem(files) {
  const normalized = new Map(Object.entries(files).map(([file, contents]) => [normalizePath(file), Buffer.from(contents)]));
  return {
    exists(file) {
      return normalized.has(normalizePath(file));
    },
    readFile(file) {
      const contents = normalized.get(normalizePath(file));
      if (!contents) throw new Error(`Missing memory file: ${file}`);
      return contents;
    },
  };
}
