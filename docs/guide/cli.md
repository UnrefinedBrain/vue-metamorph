# CLI Options

vue-metamorph provides a CLI codemod runner to faciliate running codemods against many files.

## Options

| Option | Description | Default |
| - | - | - |
| --help | Print available options | N/A |
| --files &lt;glob&gt; | Run transforms against these files using a [glob](https://www.npmjs.com/package/glob) pattern | `'**/src/**/*'` |

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
// process.on('SIGINT', abort);

```

## Adding Additional Custom CLI Options

You may attach additional arguments to your vue-metamorph CLI using the `additionalCliOptions` property. See the [commander.js docs](https://github.com/tj/commander.js?tab=readme-ov-file#options) for info on the `.option()` and `.requiredOption()` functions.

Options will be passed to the CodemodPlugin `transform()` and ManualMigrationPlugin `find()` functions as the `opts` parameter.

```ts

const myCodemod: CodemodPlugin = {
  name: 'myCodemod',
  type: 'codemod',
  transform(scriptASTs, sfcAST, filename, utils, opts) {
    if (opts.myCustomOption) {
      // behave differently
    }
  }
}

const {
  run,
  abort,
  opts,
} = createVueMetamorphCli({
  plugins: [
    myCodemod,
    // ...
  ],
  additionalCliOptions: (program) => {
    // call program.option() or program.requiredOption() to add new options
    program
      .option('--my-custom-option')
      .option('--some-other-option');
  }
});

// if you need the options outside of a codemod or manual migration, call opts()
if (opts().myCustomOption) {
  console.error('do not use this option');
  process.exit(1);
}

```
