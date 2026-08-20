import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Command } from 'commander';
import { globSync } from 'tinyglobby';
import picomatch from 'picomatch';
import type { CodemodPlugin, ManualMigrationPlugin, Plugin } from './types';
import { transform } from './transform';
import { ManualMigrationReport, findManualMigrations } from './manual';
import { createDefaultCliProgressHandler } from './default-cli-progress-handler';

/**
 * An error that occurred while parsing a file or running a plugin against it.
 * @public
 */
export type ErrorReport = {
  /**
   * The error object that was thrown.
   */
  error: Error;

  /**
   * The name of the file that the runner was processing when the error was thrown.
   */
  filename: string;
};

/**
 * The signature of the `onProgress` function that you pass to `createVueMetamorphCli()`.
 * @public
 */
export type ProgressCallback = (args: {
  /**
   * The total number of files that match the glob pattern.
   */
  totalFiles: number;

  /**
   * The number of files that the runner has already processed.
   */
  filesProcessed: number;

  /**
   * The number of files that the runner has left to process.
   */
  filesRemaining: number;

  /**
   * The number of changes that each plugin has applied or reported.
   */
  stats: Record<string, number>;

  /**
   * `true` if a call to `abort()` stopped the runner before it finished.
   */
  aborted: boolean;

  /**
   * `true` if the runner finished processing every file.
   */
  done: boolean;

  /**
   * The errors that occurred during processing.
   */
  errors: ErrorReport[];

  /**
   * The manual migrations that the manual migration plugins reported.
   */
  manualMigrations: ManualMigrationReport[];
}) => void;

/**
 * The options for the vue-metamorph CLI runner.
 * @public
 */
export interface CreateVueMetamorphCliOptions {
  /**
   * Whether to suppress the default output of the vue-metamorph CLI.
   *
   * If you set this option to `true`, use the `onProgress` function to produce your own output.
   */
  silent?: boolean;

  /**
   * The vue-metamorph CLI calls this function after it transforms a file and writes the file
   * back to disk.
   */
  onProgress?: ProgressCallback;

  /**
   * The codemod plugins and manual migration plugins to run against the matching files.
   */
  plugins: (Plugin | Plugin[])[];

  /**
   * Adds extra Commander options, which you can then read through `opts()`.
   * @param program - The Commander `Command` object.
   */
  additionalCliOptions?: (program: Pick<Command, 'option' | 'requiredOption'>) => void;
}

type ProgramOptions = {
  files: string;
  plugins: string[];
  listPlugins: boolean;
};

/**
 * Creates a CLI runner that matches files against a glob pattern and runs codemod plugins and
 * manual migration plugins against them.
 *
 * The runner parses `process.argv` for the `--files <glob>`, `--plugins <glob...>`, and
 * `--list-plugins` options, and returns an object with `run()`, `abort()`, and `opts()` methods.
 *
 * @example
 * ```ts
 * import { createVueMetamorphCli } from 'vue-metamorph';
 *
 * const { run, abort } = createVueMetamorphCli({
 *   plugins: [myCodemod, myManualMigration],
 *   onProgress({ totalFiles, filesProcessed, stats, done }) {
 *     console.log(`${filesProcessed}/${totalFiles} files processed`);
 *   },
 * });
 *
 * run();
 * ```
 *
 * @public
 */
export function createVueMetamorphCli(options: CreateVueMetamorphCliOptions) {
  const program = new Command();
  const defaultCliProgressHandler = createDefaultCliProgressHandler(console);

  program
    .requiredOption('--files <glob>', 'Run transforms against these files', '**/src/**/*')
    .requiredOption('--plugins <glob...>', 'Run only these plugins using picomatch queries', '*')
    .option('--list-plugins', 'Print a list of plugins.');

  options.additionalCliOptions?.(program);

  let aborted = false;

  const run = async (argv = process.argv) => {
    aborted = false;
    program.parse(argv);
    const opts = program.opts<ProgramOptions>();
    const stats: Record<string, number> = {};

    if (opts.listPlugins) {
      process.stdout.write(
        `${options.plugins
          .flat()
          .map((plugin) => plugin.name)
          .join('\n')}\n`,
      );
      return;
    }

    const files = globSync(opts.files, {
      absolute: true,
      onlyFiles: true,
    }).filter((file) => {
      const normalized = file.split(path.sep).join('/');

      if (normalized.includes('/node_modules/')) {
        return false;
      }

      return /\.(vue|ts|js|tsx|jsx|css|scss|less|sass|styl)$/.test(normalized);
    });

    const plugins = options.plugins
      .flat()
      .filter((plugin) => picomatch.isMatch(plugin.name, opts.plugins));

    const codemodPlugins = plugins.filter(
      (plugin): plugin is CodemodPlugin => plugin.type === 'codemod',
    );
    const manualMigrationPlugins = plugins.filter(
      (plugin): plugin is ManualMigrationPlugin => plugin.type === 'manual',
    );
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
      } catch (e) {
        if (e instanceof Error) {
          errors.push({
            filename: file,
            error: e,
          });
        }
      }

      filesProcessed++;

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
     * Runs the CLI.
     */
    run,

    /**
     * Stops the runner gracefully.
     */
    abort,

    /**
     * Returns the parsed Commander options.
     */
    opts: (argv = process.argv) => {
      program.parseOptions(argv);
      return program.opts();
    },
  };
}
