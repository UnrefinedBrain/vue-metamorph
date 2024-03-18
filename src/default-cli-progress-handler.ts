/* eslint-disable no-console */
import cliProgress from 'cli-progress';
import table from 'table';
import chalk from 'chalk';
import type { CreateVueMetamorphCliOptions } from './cli';

export const createDefaultCliProgressHandler = (console: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: (...args: any[]) => void;
}) => {
  const bar = new cliProgress.SingleBar({
    format: '{bar} | {percentage}% | Processed {value} of {total} files. Errors: {errors}',
    hideCursor: true,
    fps: 60,
  }, cliProgress.Presets.legacy);

  const defaultCliProgressHandler: Exclude<CreateVueMetamorphCliOptions['onProgress'], undefined> = ({
    aborted,
    done,
    filesProcessed,
    totalFiles,
    errors,
    manualMigrations,
    stats,
  }) => {
    if (filesProcessed === 0) {
      bar.start(totalFiles, 0, { errors: 0 });
    }

    if (aborted || done) {
      bar.stop();
      console.log(`Processed ${filesProcessed} of ${totalFiles} matching files with ${errors.length} errors`);

      // print errors
      if (errors.length > 0) {
        console.log(chalk.bold.redBright('Parse/transform errors:'));
        for (const err of errors) {
          console.log(`In file ${err.filename}:\n${err.error}\n\n`);
        }
        console.log(errors);
      }

      // print codemod stats
      console.log(
        table.table([
          [chalk.bold.blueBright('Codemod name'), chalk.bold.blueBright('Count')],
          ...Object.entries(stats),
        ]),
      );

      // print manual migrations
      if (manualMigrations.length > 0) {
        console.log(chalk.bold.blueBright('MANUAL MIGRATIONS:\n'));
        for (const migration of manualMigrations) {
          console.log(
            `${migration.file} ${migration.lineStart}:${migration.columnStart}-${migration.lineEnd}:${migration.columnEnd}\n${migration.message}\n\n${migration.snippet}\n\n---\n\n`,
          );
        }
      }
    } else {
      bar.update(filesProcessed, { errors: errors.length });
    }
  };

  return defaultCliProgressHandler;
};
