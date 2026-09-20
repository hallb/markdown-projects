import type { Command } from "commander";
import { MdpError, issueNotFound } from "../../errors.ts";
import { readConfig } from "../../lib/config.ts";
import { resolveProjectPath } from "../../lib/project-finder.ts";
import { getGlobalOptions } from "../../lib/command-utils.ts";
import { readAllIssues, findIssueAbsolutePath } from "../../lib/issue-reader.ts";
import { parseMarkdown } from "../../lib/frontmatter.ts";
import { readText } from "../../lib/fs-utils.ts";
import { readStdin } from "../../lib/stdin.ts";
import { applyIssueUpdate, writeIssueUpdate } from "../../lib/issue-operations.ts";
import { printSuccess, printError, verboseLog } from "../../output.ts";

export function registerIssueUpdateCommand(issueCmd: Command): void {
  issueCmd
    .command("update")
    .description("Update an existing issue")
    .requiredOption("--id <id>", "Issue ID to update")
    .option("-t, --title <title>", "New title")
    .option("--type <type>", "New type")
    .option("-s, --status <status>", "New status")
    .option("--priority <priority>", "New priority")
    .option("-l, --labels <labels>", "Set labels (comma-separated, replaces all)")
    .option("--add-labels <labels>", "Add labels (comma-separated)")
    .option("--remove-labels <labels>", "Remove labels (comma-separated)")
    .option("-a, --assignee <assignee>", "Set assignee (use 'none' to clear)")
    .option("-m, --milestone <milestone>", "Set milestone (use 'none' to clear)")
    .option("-e, --estimate <estimate>", "Set estimate (use 'none' to clear)")
    .option("--spent <spent>", "Set spent (use 'none' to clear)")
    .option("--due-date <date>", "Set due date YYYY-MM-DD (use 'none' to clear)")
    .option("--blocked-by <ids>", "Set blockedBy (comma-separated, replaces all)")
    .option("--add-blocked-by <ids>", "Add to blockedBy (comma-separated)")
    .option("--remove-blocked-by <ids>", "Remove from blockedBy (comma-separated)")
    .option("--parent <id>", "Set parent issue (use 'none' to clear)")
    .option("--related-to <ids>", "Set relatedTo (comma-separated, replaces all)")
    .option("--add-related-to <ids>", "Add to relatedTo (comma-separated)")
    .option("--remove-related-to <ids>", "Remove from relatedTo (comma-separated)")
    .option("--add-checklist <items>", "Add checklist items (comma-separated)")
    .option("--remove-checklist <items>", "Remove checklist items by text (comma-separated)")
    .option("--check <items>", "Check items by text (comma-separated)")
    .option("--uncheck <items>", "Uncheck items by text (comma-separated)")
    .option("-c, --content <content>", "Replace markdown body (or - for stdin)")
    .option("--dry-run", "Preview without writing", false)
    .action(async (options, cmd) => {
      try {
        const globals = getGlobalOptions(cmd);
        const projectPath = await resolveProjectPath(globals.projectPath);
        const config = await readConfig(projectPath);

        verboseLog(`Updating issue ${options.id} in ${projectPath}`);

        // Handle stdin content
        let content = options.content;
        if (content === "-") {
          content = await readStdin();
        }

        // Find the issue
        const allIssues = await readAllIssues(projectPath, config);
        const rawIssue = allIssues.find(
          (i) => i.id.toLowerCase() === options.id.toLowerCase(),
        );
        if (!rawIssue) {
          throw issueNotFound(options.id, projectPath);
        }

        // Read current file
        const absolutePath = findIssueAbsolutePath(projectPath, rawIssue.filePath);
        const rawContent = await readText(absolutePath);
        const parsed = parseMarkdown(rawContent);

        const result = applyIssueUpdate(
          {
            id: options.id,
            title: options.title,
            type: options.type,
            status: options.status,
            priority: options.priority,
            labels: options.labels,
            addLabels: options.addLabels,
            removeLabels: options.removeLabels,
            assignee: options.assignee,
            milestone: options.milestone,
            estimate: options.estimate,
            spent: options.spent,
            dueDate: options.dueDate,
            blockedBy: options.blockedBy,
            addBlockedBy: options.addBlockedBy,
            removeBlockedBy: options.removeBlockedBy,
            parent: options.parent,
            relatedTo: options.relatedTo,
            addRelatedTo: options.addRelatedTo,
            removeRelatedTo: options.removeRelatedTo,
            addChecklist: options.addChecklist,
            removeChecklist: options.removeChecklist,
            check: options.check,
            uncheck: options.uncheck,
            content,
          },
          rawIssue,
          parsed.frontmatter,
          parsed.content,
          config,
          allIssues,
        );

        if (options.dryRun) {
          printSuccess({
            dryRun: true,
            id: rawIssue.id,
            changes: result.changes,
            frontmatter: result.frontmatter,
          }, result.warnings);
          return;
        }

        const writeResult = await writeIssueUpdate(
          projectPath,
          rawIssue,
          result.frontmatter,
          result.content,
          result.titleChanged,
        );

        if (writeResult.moved) {
          verboseLog(`Moved issue to ${writeResult.filePath}`);
          printSuccess({
            id: rawIssue.id,
            changes: result.changes,
            moved: true,
            oldPath: writeResult.oldPath,
            newPath: writeResult.newPath,
            filePath: writeResult.filePath,
          }, result.warnings);
        } else {
          verboseLog(`Updated issue at ${writeResult.filePath}`);
          printSuccess({
            id: rawIssue.id,
            changes: result.changes,
            filePath: writeResult.filePath,
          }, result.warnings);
        }
      } catch (err) {
        printError(err);
        process.exit(err instanceof MdpError ? err.exitCode : 1);
      }
    });
}
