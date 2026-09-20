import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMarkdown } from "../../src/lib/frontmatter.ts";

// Regression tests for `-c -` (read the markdown body from stdin).
//
// `issue create` has always supported it. `issue update`, `milestone update`
// and `milestone create` accepted the same flag but never read stdin, so
// `-c -` wrote the literal string "-" as the whole body and discarded
// whatever was there before, with no warning. These tests drive the real CLI
// with a real pipe, because the defect was in the command wiring rather than
// in any library function.

const CLI = join(import.meta.dir, "..", "..", "src", "cli.ts");

let projectPath: string;

async function mdp(args: string[], stdin?: string) {
  const proc = Bun.spawn(["bun", "run", CLI, "-p", projectPath, ...args], {
    stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

/** The markdown body of an entity, read back from disk. */
async function bodyOf(kind: "issues" | "milestones", folder: string) {
  const file = join(projectPath, ".mdp", kind, folder, `${folder}.md`);
  return parseMarkdown(await readFile(file, "utf-8")).content.trim();
}

beforeEach(async () => {
  projectPath = await mkdtemp(join(tmpdir(), "mdp-stdin-"));
  const res = await mdp(["project", "create", "--name", "stdin-fixture"]);
  expect(res.exitCode).toBe(0);
});

afterEach(async () => {
  await rm(projectPath, { recursive: true, force: true });
});

describe("issue create -c -", () => {
  it("reads the body from stdin", async () => {
    const body = "## Description\n\nCreated from stdin.";
    const res = await mdp(["issue", "create", "-t", "From stdin", "-c", "-"], body);

    expect(res.exitCode).toBe(0);
    expect(await bodyOf("issues", "ISS-1-from-stdin")).toBe(body);
  });
});

describe("issue update -c -", () => {
  it("reads the body from stdin instead of writing a literal dash", async () => {
    await mdp(["issue", "create", "-t", "Target", "-c", "original body"]);

    const body = "## Description\n\nUpdated from stdin.\n\n## Acceptance Criteria\n\n- Body survives";
    const res = await mdp(["issue", "update", "--id", "ISS-1", "-c", "-"], body);

    expect(res.exitCode).toBe(0);
    expect(await bodyOf("issues", "ISS-1-target")).toBe(body);
  });

  it("does not destroy the existing body when stdin is used", async () => {
    await mdp(["issue", "create", "-t", "Target", "-c", "load-bearing prose"]);
    await mdp(["issue", "update", "--id", "ISS-1", "-c", "-"], "replacement prose");

    const after = await bodyOf("issues", "ISS-1-target");
    expect(after).not.toBe("-");
    expect(after).toBe("replacement prose");
  });

  it("still treats a non-dash -c value as a literal body", async () => {
    await mdp(["issue", "create", "-t", "Target", "-c", "original"]);
    await mdp(["issue", "update", "--id", "ISS-1", "-c", "literal replacement"]);

    expect(await bodyOf("issues", "ISS-1-target")).toBe("literal replacement");
  });

  it("leaves the body untouched when -c is omitted", async () => {
    await mdp(["issue", "create", "-t", "Target", "-c", "keep me"]);
    await mdp(["issue", "update", "--id", "ISS-1", "-s", "In Progress"]);

    expect(await bodyOf("issues", "ISS-1-target")).toBe("keep me");
  });
});

describe("milestone create -c -", () => {
  it("reads the body from stdin instead of writing a literal dash", async () => {
    const body = "## Goals\n\nCreated from stdin.";
    const res = await mdp(["milestone", "create", "-t", "From stdin", "-c", "-"], body);

    expect(res.exitCode).toBe(0);
    expect(await bodyOf("milestones", "M-1-from-stdin")).toBe(body);
  });
});

describe("milestone update -c -", () => {
  it("reads the body from stdin instead of writing a literal dash", async () => {
    await mdp(["milestone", "create", "-t", "Target", "-c", "original body"]);

    const body = "## Goals\n\nUpdated from stdin.";
    const res = await mdp(["milestone", "update", "--id", "M-1", "-c", "-"], body);

    expect(res.exitCode).toBe(0);
    expect(await bodyOf("milestones", "M-1-target")).toBe(body);
  });

  it("does not destroy the existing body when stdin is used", async () => {
    await mdp(["milestone", "create", "-t", "Target", "-c", "load-bearing prose"]);
    await mdp(["milestone", "update", "--id", "M-1", "-c", "-"], "replacement prose");

    const after = await bodyOf("milestones", "M-1-target");
    expect(after).not.toBe("-");
    expect(after).toBe("replacement prose");
  });

  it("leaves the body untouched when -c is omitted", async () => {
    await mdp(["milestone", "create", "-t", "Target", "-c", "keep me"]);
    await mdp(["milestone", "update", "--id", "M-1", "-s", "Active"]);

    expect(await bodyOf("milestones", "M-1-target")).toBe("keep me");
  });
});
