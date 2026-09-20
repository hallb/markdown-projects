# Milestone Commands

## Frontmatter Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | Auto-generated | Unique identifier (e.g., `M-1`) |
| `title` | `string` | -- | Milestone title |
| `status` | `string` | First status in config | Workflow stage (validated against config) |
| `priority` | `string \| null` | `null` | Urgency level (validated against config when provided) |
| `labels` | `string[]` | `[]` | Tags for filtering (validated against config) |
| `startDate` | `string \| null` | `null` | ISO 8601 date (YYYY-MM-DD) |
| `dueDate` | `string \| null` | `null` | ISO 8601 date (YYYY-MM-DD) |
| `checklist` | `object[]` | `[]` | Milestone goals (`{text, done}`) |
| `log` | `object[]` | `[]` | Activity log (`{timestamp, author, body}`) |

## Computed Fields (read-only, not stored)

| Field | Type | Description |
|-------|------|-------------|
| `totalIssues` | `number` | Count of assigned issues |
| `completedIssues` | `number` | Count of issues in a "done" status |
| `completionPercentage` | `number` | Percentage (0-100) |
| `statusBreakdown` | `Record<string, number>` | Count of issues per status |
| `estimateTotal` | `number` | Sum of `estimate` across all issues |
| `estimateCompleted` | `number` | Sum of `estimate` across completed issues |
| `spentTotal` | `number` | Sum of `spent` across all issues |
| `isOverdue` | `boolean` | `true` if past due and not 100% complete |
| `checklistTotal` | `number` | Count of checklist items |
| `checklistChecked` | `number` | Count of checked items |
| `checklistProgress` | `number \| null` | Percentage (0-100), `null` if empty |

## Create

```bash
mdp milestone create -p <path> -t "Title" [options]
```

| Option | Description |
|--------|-------------|
| `-t, --title <title>` | Milestone title (required) |
| `-s, --status <status>` | Initial status (default: first status in config) |
| `--priority <priority>` | Priority level (default: null) |
| `-l, --labels <labels>` | Comma-separated labels |
| `--start-date <date>` | Start date (YYYY-MM-DD) |
| `--due-date <date>` | Due date (YYYY-MM-DD) |
| `--checklist <items>` | Comma-separated checklist items |
| `-d, --description <desc>` | Short description |
| `-c, --content <content>` | Full markdown body (or `-` for stdin) |
| `--template <name>` | Template name from .mdp/templates/ |
| `--dry-run` | Preview without creating |

## List

```bash
mdp milestone list -p <path> [options]
```

| Option | Description |
|--------|-------------|
| `-s, --status <statuses>` | Comma-separated status filter |
| `--priority <priority>` | Priority filter |
| `-l, --labels <labels>` | Comma-separated labels filter |
| `--overdue <bool>` | `true` for overdue only, `false` for not overdue |
| `--sort <field>` | Sort: id, title, status, priority, created, updated, dueDate, completion |
| `--order <order>` | Sort order: asc, desc (default: asc) |

## Get

```bash
mdp milestone get -p <path> --id <id> [--no-include-content] [--include-issues]
```

Returns all frontmatter fields plus computed fields, content, and filePath. Use `--include-issues` to include the list of assigned issues.

## Update

```bash
mdp milestone update -p <path> --id <id> [options]
```

| Option | Description |
|--------|-------------|
| `-t, --title <title>` | New title |
| `-s, --status <status>` | New status |
| `--priority <priority>` | New priority |
| `--start-date <date>` | Set start date (`none` to clear) |
| `--due-date <date>` | Set due date (`none` to clear) |
| `-l, --labels <labels>` | Set labels (replaces all) |
| `--add-labels <labels>` | Add labels |
| `--remove-labels <labels>` | Remove labels |
| `--add-checklist <items>` | Add checklist items |
| `--remove-checklist <items>` | Remove checklist items by text |
| `--check <items>` | Check items by text |
| `--uncheck <items>` | Uncheck items by text |
| `-c, --content <content>` | Replace markdown body (or `-` for stdin) |
| `--dry-run` | Preview without writing |

## Delete

```bash
mdp milestone delete -p <path> --id <id> [--dry-run]
```

Removes the milestone folder and clears `milestone` reference from all assigned issues.

## Progress

```bash
mdp milestone progress -p <path> --id <id>
```

Returns completion percentage, issue counts by status, estimate/spent totals, overdue status, and checklist progress.

## Log

```bash
mdp milestone log add -p <path> --id <id> -b "message" [--author <name>] [--dry-run]
mdp milestone log list -p <path> --id <id>
mdp milestone log get -p <path> --id <id> --index <n>
mdp milestone log update -p <path> --id <id> --index <n> [--author <a>] [-b <body>] [--dry-run]
mdp milestone log delete -p <path> --id <id> --index <n> [--dry-run]
```
