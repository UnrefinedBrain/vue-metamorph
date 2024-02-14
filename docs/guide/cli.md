# CLI Options

vue-metamorph provides a CLI codemod runner to faciliate running codemods against many files.

## Options

| Option | Description | Default |
| - | - | - |
| --help | Print available options | N/A |
| --files \<glob> | Run transforms against these files using a [glob](https://www.npmjs.com/package/glob) pattern | `'**/src/**/*'` |

## API

```ts twoslash
import { createVueMetamorphCli } from 'vue-metamorph';

const { run, abort } = createVueMetamorphCli({
  silent: true, // suppress vue-metamorph's default output by setting silent:true

  onProgress({
    totalFiles,
    filesProcessed,
    filesRemaining,
    stats,
    aborted,
    done,
    errors,
    manualMigrations,
  }) {
    // called every time a file was transformed
    // also called when vue-metamorph finished processing all files (with done:true)
    // also called when vue-metamorph was aborted via the `abort()` function (with aborted:true)
  },

  // register your CodemodPlugins and/or ManualMigrationPlugins here
  plugins: [],
});

run();

// call abort() to gracefully stop the runner
// process.on('SIGTERM', abort);

```
