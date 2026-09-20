# Installation

## Requirements

- [Bun](https://bun.sh) v1.0.0 or higher

## Install

```bash
bun install -g github:hallb/markdown-projects
```

This installs the `mdp` command globally. Bun runs TypeScript directly — no build step needed.

`hallb/markdown-projects` is a fork of `varunpandey0502/markdown-projects`.
Install from the fork, not upstream. Upstream's `issue update`,
`milestone update` and `milestone create` accept `-c -` but never read stdin,
so they write the literal string `-` as the whole body and discard the
previous one without warning. The fork fixes all three and has regression
tests for them. Upstream has been dormant since February 2026.

## Verify

```bash
mdp --version
```

## Update

```bash
bun install -g github:hallb/markdown-projects
```

Re-running the install command pulls the latest version.

## Uninstall

```bash
bun remove -g markdown-projects
```

