import { Command } from 'commander';
import { globSync } from 'glob';
import { promises as fs } from 'fs';
import micromatch from 'micromatch';
import type { CodemodPlugin, ManualMigrationPlugin, Plugin } from './types';
import { transform } from './transform';
import { ManualMigrationReport, findManualMigrations } from './manual';
import { createDefaultCliProgressHandler } from './default-cli-progress-handler';

/**
 * An error that was encountered during parsing or plugin execution
 * @public
 */
export type ErrorReport = {
  /**
   * The error object that was thrown
   */
  error: Error;

  /**
   * The filename that was being processed when the error was thrown
   */
  filename: string;
};

/**
 * Function signature for the onProgress function passed to createVueMetamorphCli
 * @public
 */
export type ProgressCallback = (args: {
  /**
   * Total number files matching the glob input
   */
  totalFiles: number;

  /**
   * Number of files that have already been processed
   */
  filesProcessed: number;

  /**
   * Number of files left to be processed
   */
  filesRemaining: number;

  /**
   * Number of changes each plugin has applied or reported
   */
  stats: Record<string, number>;

  /**
   * True if the runner was aborted before completing
   */
  aborted: boolean;

  /**
   * True if the runner finished processing all files
   */
  done: boolean;

  /**
   * Errors encountered during processing
   */
  errors: ErrorReport[];

  /**
   * Manual migrations reported by manual migration plugins
   */
  manualMigrations: ManualMigrationReport[];
}) => void;

/**
 * vue-metamorph CLI Options
 * @public
 */
export interface CreateVueMetamorphCliOptions {
  /**
   * Whether to suppress the default output of vue-metamorph's CLI
   *
   * If you set this to true, use the onProgress function to define your own output
   */
  silent?: boolean;

  /**
   * The vue-metamorph CLI will call this function when a file has been transformed
   * and written back to disk
   */
  onProgress?: ProgressCallback;

  /**
   * List of codemods / manual migrations to run against matching files
   */
  plugins: (Plugin | Plugin[])[];

  /**
   * Add additional commander options to access with opts()
   * @param program - Commander Command
   */
  additionalCliOptions?: (program: Pick<Command, 'option' | 'requiredOption'>) => void;
}

type ProgramOptions = {
  files: string;
  plugins: string[];
  listPlugins: boolean;
};

/**
 * Creates a CLI instance
 * @public
 */
export function createVueMetamorphCli(options: CreateVueMetamorphCliOptions) {
  const program = new Command();
  const defaultCliProgressHandler = createDefaultCliProgressHandler(console);

  program
    .requiredOption('--files <glob>', 'Run transforms against these files', '**/src/**/*')
    .requiredOption('--plugins <glob...>', 'Run only these plugins using micromatch queries', '*')
    .option('--list-plugins', 'Print a list of plugins.');

  options.additionalCliOptions?.(program);

  let aborted = false;

  const run = async (argv = process.argv) => {
    program.parse(argv);
    const opts = program.opts<ProgramOptions>();
    const stats: Record<string, number> = {};

    if (opts.listPlugins) {
      process.stdout.write(`${options.plugins.flat().map((plugin) => plugin.name).join('\n')}\n`);
      process.exit(0);
    }

    const files = globSync(opts.files, {
      absolute: true,
      nodir: true,
      ignore: {
        ignored(p) {
          if (p.fullpath().includes('node_modules')) {
            return true;
          }

          if (!/\.(vue|ts|js|tsx|jsx|css|scss|less|sass|styl)$/.test(p.fullpath())) {
            return true;
          }

          return false;
        },
      },
    });

    const plugins = options
      .plugins
      .flat()
      .filter((plugin) => micromatch.isMatch(plugin.name, opts.plugins));

    const codemodPlugins = plugins.filter((plugin): plugin is CodemodPlugin => plugin.type === 'codemod');
    const manualMigrationPlugins = plugins.filter((plugin): plugin is ManualMigrationPlugin => plugin.type === 'manual');
    const manualMigrationReports: ManualMigrationReport[] = [];

    const errors: {
      filename: string;
      error: Error;
    }[] = [];

    let filesProcessed = 0;

    for (const file of files) {
      if (aborted) {
        const progressArgs = {
          stats,
          aborted: true,
          done: false,
          filesProcessed,
          filesRemaining: files.length - filesProcessed,
          totalFiles: files.length,
          errors,
          manualMigrations: manualMigrationReports,
        };

        if (!options.silent) {
          defaultCliProgressHandler(progressArgs);
        }
        options.onProgress?.(progressArgs);

        return;
      }

      try {
        const code = (await fs.readFile(file)).toString('utf-8');

        const newCode = transform(code, file, codemodPlugins, opts);

        let writeFile = false;

        for (const [name, count] of newCode.stats) {
          stats[name] ??= 0;
          stats[name] += count;

          if (count > 0) {
            writeFile = true;
          }
        }

        if (writeFile) {
          await fs.writeFile(file, newCode.code);
        }

        if (manualMigrationPlugins.length > 0) {
          manualMigrationReports.push(
            ...findManualMigrations(newCode.code, file, manualMigrationPlugins, opts),
          );
        }

        const progressArgs = {
          stats,
          aborted: false,
          done: false,
          filesProcessed,
          filesRemaining: files.length - filesProcessed,
          totalFiles: files.length,
          errors,
          manualMigrations: manualMigrationReports,
        };
        if (!options.silent) {
          defaultCliProgressHandler(progressArgs);
        }
        options.onProgress?.(progressArgs);
      } catch (e) {
        if (e instanceof Error) {
          errors.push({
            filename: file,
            error: e,
          });
        }
      }

      filesProcessed++;
    }

    const progressArgs = {
      stats,
      aborted: false,
      done: true,
      filesProcessed,
      filesRemaining: files.length - filesProcessed,
      totalFiles: files.length,
      errors,
      manualMigrations: manualMigrationReports,
    };
    if (!options.silent) {
      defaultCliProgressHandler(progressArgs);
    }
    options.onProgress?.(progressArgs);
  };

  const abort = () => {
    aborted = true;
  };

  return {
    /**
     * Run the CLI
     */
    run,

    /**
     * Stops progress of the runner
     */
    abort,

    /**
     * Commander arguments
     */
    opts: (argv = process.argv) => {
      program.parseOptions(argv);
      return program.opts();
    },
  };
}
