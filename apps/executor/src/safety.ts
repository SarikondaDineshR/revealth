import path from "node:path";

export function assertSafeRepoPath(value: string): void {
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw Object.assign(new Error("Execution contract paths must be repository-relative."), {
      code: "CODEX_ABSOLUTE_PATH_REJECTED",
    });
  }
  const normalized = normalizeRepoPath(value);
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..")
  ) {
    throw Object.assign(new Error("Execution contract paths cannot contain path traversal."), {
      code: "CODEX_PATH_TRAVERSAL_REJECTED",
    });
  }
}

export function assertSafeCommand(value: string): void {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw Object.assign(new Error("Execution contract commands cannot be empty."), {
      code: "CODEX_EMPTY_COMMAND_REJECTED",
    });
  }
  if (/[;&|<>`]/.test(trimmed) || trimmed.includes("$(")) {
    throw Object.assign(new Error("Execution contract commands cannot include shell control operators."), {
      code: "CODEX_UNSAFE_COMMAND_OPERATOR_REJECTED",
    });
  }
}

export function validateSafetySnapshot(input: {
  allowedFiles: string[];
  forbiddenFiles: string[];
  allowedCommands: string[];
  forbiddenCommands: string[];
}): void {
  assertNonEmpty("allowed files", input.allowedFiles);
  assertNonEmpty("forbidden files", input.forbiddenFiles);
  assertNonEmpty("allowed commands", input.allowedCommands);
  assertNonEmpty("forbidden commands", input.forbiddenCommands);

  for (const file of [...input.allowedFiles, ...input.forbiddenFiles]) assertSafeRepoPath(file);
  for (const command of [...input.allowedCommands, ...input.forbiddenCommands]) assertSafeCommand(command);

  const allowedDirectories = input.allowedFiles
    .filter((file) => file.endsWith("/"))
    .map((file) => normalizeRepoPath(file));
  const wildcardAllowedFiles = input.allowedFiles.filter((file) => normalizeRepoPath(file).includes("*"));
  if (wildcardAllowedFiles.length > 0) {
    throw Object.assign(new Error("Allowed files must be exact repository-relative files or directories."), {
      code: "CODEX_ALLOWED_FILE_WILDCARD_REJECTED",
      details: { wildcardAllowedFiles },
    });
  }
  const outsideAllowed = input.allowedFiles
    .filter((file) => !file.endsWith("/"))
    .filter((file) => allowedDirectories.length > 0 && !isInsideAllowedDirectory(file, allowedDirectories));
  if (outsideAllowed.length > 0) {
    throw Object.assign(new Error("Allowed files must be inside allowed directories."), {
      code: "CODEX_FILE_OUTSIDE_ALLOWED_DIRECTORIES",
      details: { fileEntriesOutsideAllowedDirectories: outsideAllowed },
    });
  }

  const overlappingFiles = input.allowedFiles.filter((file) =>
    input.forbiddenFiles.some((forbiddenFile) => pathMatchesPattern(file, forbiddenFile)),
  );
  if (overlappingFiles.length > 0) {
    throw Object.assign(new Error("Allowed files cannot also be forbidden files."), {
      code: "CODEX_FORBIDDEN_FILE_CONFLICT",
      details: { overlappingFiles },
    });
  }

  const overlappingCommands = input.allowedCommands.filter((command) =>
    input.forbiddenCommands.some((forbiddenCommand) => commandMatchesPattern(command, forbiddenCommand)),
  );
  if (overlappingCommands.length > 0) {
    throw Object.assign(new Error("Allowed commands cannot also be forbidden commands."), {
      code: "CODEX_FORBIDDEN_COMMAND_CONFLICT",
      details: { overlappingCommands },
    });
  }
}

function assertNonEmpty(label: string, values: string[]): void {
  if (values.length === 0) {
    throw Object.assign(new Error(`Codex execution run must include ${label}.`), {
      code: "CODEX_EXECUTION_SAFETY_SNAPSHOT_INCOMPLETE",
    });
  }
}

function normalizeRepoPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function isInsideAllowedDirectory(file: string, allowedDirectories: string[]): boolean {
  const normalized = normalizeRepoPath(file);
  return allowedDirectories.some((directory) => normalized.startsWith(directory));
}

function pathMatchesPattern(value: string, pattern: string): boolean {
  const normalizedValue = normalizeRepoPath(value);
  const normalizedPattern = normalizeRepoPath(pattern);
  if (normalizedValue === normalizedPattern) return true;
  if (normalizedPattern.endsWith("/") && normalizedValue.startsWith(normalizedPattern)) return true;
  return new RegExp(`^${wildcardPatternToRegex(normalizedPattern)}$`).test(normalizedValue);
}

function commandMatchesPattern(command: string, pattern: string): boolean {
  if (command === pattern) return true;
  return new RegExp(`^${wildcardPatternToRegex(pattern, ".*")}$`).test(command);
}

function wildcardPatternToRegex(pattern: string, singleStarReplacement = "[^/]*"): string {
  let regex = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern.charAt(index);
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      regex += ".*";
      index += 1;
      continue;
    }
    if (char === "*") {
      regex += singleStarReplacement;
      continue;
    }
    regex += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return regex;
}
