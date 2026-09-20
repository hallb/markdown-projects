import { join, dirname, basename } from "node:path";
import type { Command } from "commander";
import { PROJECT_DIR } from "../../constants.ts";
import { MdpError, milestoneNotFound } from "../../errors.ts";
import { readConfig } from "../../lib/config.ts";
import { resolveProjectPath } from "../../lib/project-finder.ts";
import { getGlobalOptions } from "../../lib/command-utils.ts";
import { readAllMilestones, findMilestoneAbsolutePath } from "../../lib/milestone-reader.ts";
import { buildMarkdown, parseMarkdown } from "../../lib/frontmatter.ts";
import { readText, writeText, renameEntry, pathExists } from "../../lib/fs-utils.ts";
import { readStdin } from "../../lib/stdin.ts";
import { slugify } from "../../lib/slug.ts";
import { validateStatus, validatePriority, validateLabels, validateDate, parseCommaSeparated } from "../../lib/validators.ts";
import { printSuccess, printError, verboseLog } from "../../output.ts";

export function registerMilestoneUpdateCommand(milestoneCmd: Command): void {
  milestoneCmd
    .command("update")
    .description("Update an existing milestone")
    .requiredOption("--id <id>", "Milestone ID to update")
    .option("-t, --title <title>", "New title")
    .option("-s, --status <status>", "New status")
    .option("--priority <priority>", "New priority")
    .option("-l, --labels <labels>", "Set labels (comma-separated, replaces all)")
    .option("--add-labels <labels>", "Add labels (comma-separated)")
    .option("--remove-labels <labels>", "Remove labels (comma-separated)")
    .option("--start-date <date>", "Set start date YYYY-MM-DD (use 'none' to clear)")
    .option("--due-date <date>", "Set due date YYYY-MM-DD (use 'none' to clear)")
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
        const warnings: string[] = [];

        verboseLog(`Updating milestone ${options.id} in ${projectPath}`);

        const allMilestones = await readAllMilestones(projectPath, config);
        const rawMilestone = allMilestones.find(
          (m) => m.id.toLowerCase() === options.id.toLowerCase(),
        );
        if (!rawMilestone) {
          throw milestoneNotFound(options.id, projectPath);
        }

        const absolutePath = findMilestoneAbsolutePath(projectPath, rawMilestone.filePath);
        const rawContent = await readText(absolutePath);
        const parsed = parseMarkdown(rawContent);
        const fm = { ...parsed.frontmatter };
        const changes: Record<string, { from: unknown; to: unknown }> = {};

        // Simple fields
        if (options.title !== undefined) {
          changes.title = { from: fm.title, to: options.title };
          fm.title = options.title;
        }

        if (options.status !== undefined) {
          const validated = validateStatus(config.milestones.statuses, options.status);
          changes.status = { from: fm.status, to: validated };
          fm.status = validated;
        }

        if (options.priority !== undefined) {
          const validated = validatePriority(config.milestones.priorities, options.priority);
          changes.priority = { from: fm.priority, to: validated };
          fm.priority = validated;
        }

        if (options.startDate !== undefined) {
          const val = validateDate(options.startDate) || null;
          changes.startDate = { from: fm.startDate, to: val };
          fm.startDate = val;
        }

        if (options.dueDate !== undefined) {
          const val = validateDate(options.dueDate) || null;
          changes.dueDate = { from: fm.dueDate, to: val };
          fm.dueDate = val;
        }

        // Labels
        let currentLabels = Array.isArray(fm.labels) ? [...(fm.labels as string[])] : [];

        if (options.labels !== undefined) {
          const parsed = parseCommaSeparated(options.labels);
          const validated = validateLabels(config.milestones.labels, parsed);
          changes.labels = { from: currentLabels, to: validated };
          currentLabels = validated;
        }
        if (options.addLabels) {
          const toAdd = parseCommaSeparated(options.addLabels);
          const validated = validateLabels(config.milestones.labels, toAdd);
          const before = [...currentLabels];
          for (const label of validated) {
            if (!currentLabels.some((l) => l.toLowerCase() === label.toLowerCase())) {
              currentLabels.push(label);
            }
          }
          changes.labels = { from: before, to: currentLabels };
        }
        if (options.removeLabels) {
          const toRemove = parseCommaSeparated(options.removeLabels).map((s) => s.toLowerCase());
          const before = [...currentLabels];
          currentLabels = currentLabels.filter((l) => !toRemove.includes(l.toLowerCase()));
          changes.labels = { from: before, to: currentLabels };
        }
        fm.labels = currentLabels;

        // Checklist
        let currentChecklist = Array.isArray(fm.checklist)
          ? (fm.checklist as Array<{ text: string; done: boolean }>).map((c) => ({ ...c }))
          : [];

        if (options.addChecklist) {
          const items = parseCommaSeparated(options.addChecklist);
          for (const text of items) {
            currentChecklist.push({ text, done: false });
          }
          changes.checklist = { from: "modified", to: `added ${items.length} items` };
        }
        if (options.removeChecklist) {
          const toRemove = parseCommaSeparated(options.removeChecklist).map((s) => s.toLowerCase());
          const before = currentChecklist.length;
          currentChecklist = currentChecklist.filter((c) => !toRemove.includes(c.text.toLowerCase()));
          changes.checklist = { from: "modified", to: `removed ${before - currentChecklist.length} items` };
        }
        if (options.check) {
          const toCheck = parseCommaSeparated(options.check).map((s) => s.toLowerCase());
          for (const item of currentChecklist) {
            if (toCheck.includes(item.text.toLowerCase())) {
              item.done = true;
            }
          }
          changes.checklist = { from: "modified", to: `checked ${toCheck.length} items` };
        }
        if (options.uncheck) {
          const toUncheck = parseCommaSeparated(options.uncheck).map((s) => s.toLowerCase());
          for (const item of currentChecklist) {
            if (toUncheck.includes(item.text.toLowerCase())) {
              item.done = false;
            }
          }
          changes.checklist = { from: "modified", to: `unchecked ${toUncheck.length} items` };
        }
        fm.checklist = currentChecklist;

        // Content
        let content = parsed.content;
        if (options.content !== undefined) {
          content = options.content === "-" ? await readStdin() : options.content;
          changes.content = { from: "(previous)", to: "(updated)" };
        }

        fm.updatedAt = new Date().toISOString();

        if (options.dryRun) {
          printSuccess({
            dryRun: true,
            id: rawMilestone.id,
            changes,
            frontmatter: fm,
          }, warnings);
          return;
        }

        const markdown = buildMarkdown(fm, content);

        // Check if folder rename needed (only for title changes)
        if (options.title !== undefined) {
          const currentMdPath = join(projectPath, rawMilestone.filePath);
          const currentFolderPath = dirname(currentMdPath);
          const currentFolderName = basename(currentFolderPath);
          const parentDir = dirname(currentFolderPath);

          const newSlug = slugify(options.title);
          const newFolderName = `${rawMilestone.id}-${newSlug}`;
          const newFolderPath = join(parentDir, newFolderName);

          if (currentFolderPath !== newFolderPath) {
            await renameEntry(currentFolderPath, newFolderPath);

            const oldMdName = `${currentFolderName}.md`;
            const newMdFileName = `${newFolderName}.md`;
            if (oldMdName !== newMdFileName) {
              const oldMdInsideNewFolder = join(newFolderPath, oldMdName);
              if (await pathExists(oldMdInsideNewFolder)) {
                await renameEntry(oldMdInsideNewFolder, join(newFolderPath, newMdFileName));
              }
            }

            const newRelativePath = `${PROJECT_DIR}/milestones/${newFolderName}/${newFolderName}.md`;
            const newAbsPath = findMilestoneAbsolutePath(projectPath, newRelativePath);
            await writeText(newAbsPath, markdown);

            verboseLog(`Moved milestone to ${newRelativePath}`);

            printSuccess({
              id: rawMilestone.id,
              changes,
              moved: true,
              oldPath: rawMilestone.filePath,
              newPath: newRelativePath,
              filePath: newRelativePath,
            }, warnings);
            return;
          }
        }

        await writeText(absolutePath, markdown);
        verboseLog(`Updated milestone at ${absolutePath}`);

        printSuccess({
          id: rawMilestone.id,
          changes,
          filePath: rawMilestone.filePath,
        }, warnings);
      } catch (err) {
        printError(err);
        process.exit(err instanceof MdpError ? err.exitCode : 1);
      }
    });
}
