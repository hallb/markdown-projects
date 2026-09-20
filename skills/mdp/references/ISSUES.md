# Issue Commands

## Frontmatter Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | Auto-generated | Unique identifier (e.g., `ISS-1`) |
| `title` | `string` | -- | Issue title |
| `type` | `string \| null` | `null` | Issue type (validated against config when provided) |
| `status` | `string` | First status in config | Workflow stage (validated against config) |
| `priority` | `string \| null` | `null` | Urgency level (validated against config when provided) |
| `labels` | `string[]` | `[]` | Tags for filtering (validated against config) |
| `assignee` | `string \| null` | `null` | Who is working on this |
| `milestone` | `string \| null` | `null` | Milestone ID |
| `estimate` | `number \| null` | `null` | Effort points |
| `spent` | `number \| null` | `null` | Actual effort spent |
| `dueDate` | `string \| null` | `null` | ISO 8601 date (YYYY-MM-DD) |
| `blockedBy` | `string[]` | `[]` | Issue IDs this depends on (cycles rejected) |
| `parent` | `string \| null` | `null` | Parent issue ID |
| `relatedTo` | `string[]` | `[]` | Related issue IDs |
| `checklist` | `object[]` | `[]` | Checklist items (`{text, done}`) |
| `log` | `object[]` | `[]` | Activity log (`{timestamp, author, body}`) |

## Computed Fields (read-only, not stored)

| Field | Type | Description |
|-------|------|-------------|
| `blocks` | `string[]` | Inverse of `blockedBy` -- which issues are blocked by this one |
| `children` | `string[]` | Inverse of `parent` -- which issues have this as parent |
| `checklistTotal` | `number` | Count of checklist items |
| `checklistChecked` | `number` | Count of checked items |
| `checklistProgress` | `number \| null` | Percentage (0-100), `null` if empty |

## File Naming

Each issue lives in its own folder: `{id}-{slug}/{id}-{slug}.md`

Example: `ISS-1-implement-auth/ISS-1-implement-auth.md`

Slugs are derived from the title: lowercase, non-alphanumeric replaced with hyphens, truncated to 50 characters.

## Create

```bash
mdp issue create -p <path> -t "Title" [options]
```

| Option | Description |
|--------|-------------|
| `-t, --title <title>` | Issue title (required) |
| `--type <type>` | Issue type (default: null) |
| `-s, --status <status>` | Initial status (default: first status in config) |
| `--priority <priority>` | Priority level (default: null) |
| `-l, --labels <labels>` | Comma-separated labels |
| `-a, --assignee <assignee>` | Assignee identifier |
| `-m, --milestone <milestone>` | Milestone ID |
| `-e, --estimate <estimate>` | Effort points (positive integer) |
| `--spent <spent>` | Actual effort spent |
| `--due-date <date>` | Due date (YYYY-MM-DD) |
| `--blocked-by <ids>` | Comma-separated issue IDs |
| `--parent <id>` | Parent issue ID |
| `--related-to <ids>` | Comma-separated issue IDs |
| `--checklist <items>` | Comma-separated checklist items |
| `-d, --description <desc>` | Short description |
| `-c, --content <content>` | Full markdown body (or `-` for stdin) |
| `--template <name>` | Template name from .mdp/templates/ |
| `--dry-run` | Preview without creating |

## List

```bash
mdp issue list -p <path> [options]
```

| Option | Description |
|--------|-------------|
| `-s, --status <statuses>` | Comma-separated status filter |
| `--type <types>` | Comma-separated type filter |
| `--priority <priority>` | Priority filter |
| `-l, --labels <labels>` | Comma-separated labels filter |
| `-a, --assignee <assignee>` | Filter by assignee (`none` for unassigned) |
| `-m, --milestone <milestone>` | Filter by milestone ID (`none` for unassigned) |
| `--blocked <bool>` | `true` for blocked only, `false` for unblocked |
| `--parent <id>` | Filter by parent issue ID (`none` for top-level) |
| `--created-after <date>` | Created after date (YYYY-MM-DD) |
| `--created-before <date>` | Created before date (YYYY-MM-DD) |
| `--due-before <date>` | Due before date (YYYY-MM-DD) |
| `--due-after <date>` | Due after date (YYYY-MM-DD) |
| `--sort <field>` | Sort: id, title, status, priority, type, created, updated, estimate, spent, dueDate |
| `--order <order>` | Sort order: asc, desc (default: asc) |

## Get

```bash
mdp issue get -p <path> --id <id> [--no-include-content]
```

Returns all frontmatter fields plus computed fields, content, and filePath.

## Update

```bash
mdp issue update -p <path> --id <id> [options]
```

| Option | Description |
|--------|-------------|
| `-t, --title <title>` | New title (renames folder/file) |
| `--type <type>` | New type |
| `-s, --status <status>` | New status |
| `--priority <priority>` | New priority |
| `-a, --assignee <assignee>` | Set assignee (`none` to clear) |
| `-m, --milestone <milestone>` | Set milestone (`none` to clear) |
| `-e, --estimate <estimate>` | Set estimate (`none` to clear) |
| `--spent <spent>` | Set spent (`none` to clear) |
| `--due-date <date>` | Set due date (`none` to clear) |
| `--parent <id>` | Set parent issue (`none` to clear) |
| `-l, --labels <labels>` | Set labels (replaces all) |
| `--add-labels <labels>` | Add labels |
| `--remove-labels <labels>` | Remove labels |
| `--blocked-by <ids>` | Set blockedBy (replaces all) |
| `--add-blocked-by <ids>` | Add to blockedBy (with cycle detection) |
| `--remove-blocked-by <ids>` | Remove from blockedBy |
| `--related-to <ids>` | Set relatedTo (replaces all) |
| `--add-related-to <ids>` | Add to relatedTo |
| `--remove-related-to <ids>` | Remove from relatedTo |
| `--add-checklist <items>` | Add checklist items |
| `--remove-checklist <items>` | Remove checklist items by text |
| `--check <items>` | Check items by text |
| `--uncheck <items>` | Uncheck items by text |
| `-c, --content <content>` | Replace markdown body (or `-` for stdin) |
| `--dry-run` | Preview without writing |

## Delete

```bash
mdp issue delete -p <path> --id <id> [--dry-run]
```

Removes the issue folder and cleans up `blockedBy`, `relatedTo`, and `parent` references in other issues.

## Batch Create

```bash
echo '<json-array>' | mdp issue batch-create -p <path> [--dry-run]
```

Input: JSON array of issue objects. Required field: `title`. All other fields match `issue create` options. Processes sequentially; continues on error.

## Batch Update

```bash
echo '<json-array>' | mdp issue batch-update -p <path> [--dry-run]
```

Input: JSON array of update objects. Required field: `id`. All other fields match `issue update` options. Processes sequentially; continues on error.

## Log

```bash
mdp issue log add -p <path> --id <id> -b "message" [--author <name>] [--dry-run]
mdp issue log list -p <path> --id <id>
mdp issue log get -p <path> --id <id> --index <n>
mdp issue log update -p <path> --id <id> --index <n> [--author <a>] [-b <body>] [--dry-run]
mdp issue log delete -p <path> --id <id> --index <n> [--dry-run]
```
