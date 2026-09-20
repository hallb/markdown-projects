import { join } from "node:path";
import type { Command } from "commander";
import { PROJECT_DIR } from "../../constants.ts";
import { MdpError } from "../../errors.ts";
import { readConfig } from "../../lib/config.ts";
import { resolveProjectPath } from "../../lib/project-finder.ts";
import { getGlobalOptions } from "../../lib/command-utils.ts";
import { getNextId } from "../../lib/id.ts";
import { slugify } from "../../lib/slug.ts";
import { readStdin } from "../../lib/stdin.ts";
import { buildMarkdown, parseMarkdown } from "../../lib/frontmatter.ts";
import { ensureDir, writeText, readText, pathExists } from "../../lib/fs-utils.ts";
import { validateStatus, validatePriority, validateLabels, validateDate, parseCommaSeparated } from "../../lib/validators.ts";
import { getDefaultMilestoneStatus } from "../../lib/config-defaults.ts";
import { printSuccess, printError, verboseLog } from "../../output.ts";
import type { ChecklistItem, LogEntry } from "../../types.ts";

export function registerMilestoneCreateCommand(milestoneCmd: Command): void {
  milestoneCmd
    .command("create")
    .description("Create a new milestone")
    .requiredOption("-t, --title <title>", "Milestone title")
    .option("-s, --status <status>", "Initial status")
    .option("--priority <priority>", "Priority level")
    .option("-l, --labels <labels>", "Comma-separated labels")
    .option("--start-date <date>", "Start date (YYYY-MM-DD)")
    .option("--due-date <date>", "Due date (YYYY-MM-DD)")
    .option("--checklist <items>", "Comma-separated checklist items")
    .option("-d, --description <desc>", "Short description")
    .option("-c, --content <content>", "Full markdown body (or - for stdin)")
    .option("--template <name>", "Template name from .mdp/templates/")
    .option("--dry-run", "Preview without creating", false)
    .action(async (options, cmd) => {
      try {
        const globals = getGlobalOptions(cmd);
        const projectPath = await resolveProjectPath(globals.projectPath);
        const config = await readConfig(projectPath);
        const warnings: string[] = [];

        verboseLog(`Creating milestone in ${projectPath}`);

        // Validate fields
        const status = validateStatus(config.milestones.statuses, options.status ?? getDefaultMilestoneStatus(config));
        const priority = options.priority ? validatePriority(config.milestones.priorities, options.priority) : null;

        const labelsRaw = parseCommaSeparated(options.labels);
        const labels = validateLabels(config.milestones.labels, labelsRaw);

        const startDate = options.startDate ? validateDate(options.startDate) : null;
        const dueDate = options.dueDate ? validateDate(options.dueDate) : null;

        const checklistItems = parseCommaSeparated(options.checklist);
        const checklist: ChecklistItem[] = checklistItems.map((text) => ({ text, done: false }));

        // Handle template
        let templateContent = "";
        let templateFrontmatter: Record<string, unknown> = {};
        if (options.template) {
          const templatePath = join(projectPath, PROJECT_DIR, "templates", `${options.template}.md`);
          if (!(await pathExists(templatePath))) {
            throw new MdpError("TEMPLATE_NOT_FOUND", `Template "${options.template}" not found`, { name: options.template });
          }
          const templateRaw = await readText(templatePath);
          const parsed = parseMarkdown(templateRaw);
          templateFrontmatter = parsed.frontmatter;
          templateContent = parsed.content;
        }

        // Handle content
        let content = "";
        if (options.content) {
          content = options.content === "-" ? await readStdin() : options.content;
        } else if (options.description) {
          content = `## Goals\n\n${options.description}\n`;
        } else if (templateContent) {
          content = templateContent;
        }

        // Generate ID
        const id = options.dryRun ? `${config.milestones.prefix}-XXX` : await getNextId(projectPath, config.milestones.prefix, "milestones");
        const slug = slugify(options.title);
        const folderName = `${id}-${slug}`;

        const now = new Date().toISOString();

        const frontmatter: Record<string, unknown> = {
          id,
          title: options.title,
          status,
          priority: priority ?? (templateFrontmatter.priority as string | null) ?? null,
          labels: labels.length > 0 ? labels : (templateFrontmatter.labels as string[]) || [],
          startDate: startDate ?? (templateFrontmatter.startDate as string | null) ?? null,
          dueDate: dueDate || (templateFrontmatter.dueDate as string | null) || null,
          checklist: checklist.length > 0 ? checklist : (templateFrontmatter.checklist as ChecklistItem[]) || [],
          log: (templateFrontmatter.log as LogEntry[]) || [],
          createdAt: now,
          updatedAt: now,
        };

        const filePath = `${PROJECT_DIR}/milestones/${folderName}/${folderName}.md`;

        if (options.dryRun) {
          printSuccess({
            dryRun: true,
            ...frontmatter,
            filePath,
            content,
          }, warnings);
          return;
        }

        // Write to disk
        const fullDirPath = join(projectPath, PROJECT_DIR, "milestones", folderName);
        await ensureDir(fullDirPath);

        const markdown = buildMarkdown(frontmatter, content);
        const fullFilePath = join(fullDirPath, `${folderName}.md`);
        await writeText(fullFilePath, markdown);

        verboseLog(`Created milestone at ${fullFilePath}`);

        printSuccess({
          ...frontmatter,
          filePath,
        }, warnings);
      } catch (err) {
        printError(err);
        process.exit(err instanceof MdpError ? err.exitCode : 1);
      }
    });
}
