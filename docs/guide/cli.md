# Command-line interface

vue-metamorph provides a CLI codemod runner that runs your codemods against many files.

## Options

The CLI runner accepts the following options:

| Option | Description | Default |
| - | - | - |
| `--help` | Prints the available options. | N/A |
| `--list-plugins` | Lists all registered plugins, then exits. | N/A |
| `--files <glob>` | Runs transforms against the files that match a [glob](https://www.npmjs.com/package/glob) pattern. | `'**/src/**/*'` |
| `--plugins <glob>` | Runs only the plugins that match a [picomatch](https://github.com/micromatch/picomatch) pattern. To specify more than one pattern, pass this option multiple times. | `'*'` |

## API

To create the CLI runner, call `createVueMetamorphCli()`:

```ts twoslash
import { createVueMetamorphCli } from 'vue-metamorph';

const { run, abort } = createVueMetamorphCli({
  // set silent to true to suppress vue-metamorph's default output
  silent: true,

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
    // called every time a file is transformed
    // also called when vue-metamorph finishes processing all files (with done:true)
    // also called when the abort() function stops the runner (with aborted:true)
  },

  // register your CodemodPlugins and ManualMigrationPlugins here
  plugins: [],
});

run();

// call abort() to stop the runner gracefully
// process.on('SIGINT', abort);

```

## Add custom CLI options

Register options with `additionalCliOptions`. vue-metamorph passes the parsed values
through `opts` to every plugin's `transform()` or `find()` function.

This example adds a flag to enable string replacement and an option for the replacement
value. It counts only literals whose values change:

```ts twoslash
import { createVueMetamorphCli, type CodemodPlugin } from 'vue-metamorph';

const replaceStrings: CodemodPlugin = {
  name: 'replace-strings',
  type: 'codemod',
  transform({ opts, scriptASTs, utils: { astHelpers } }) {
    if (!opts.replaceStrings || typeof opts.replacement !== 'string') {
      return 0;
    }
    let count = 0;
    for (const script of scriptASTs) {
      for (const literal of astHelpers.findAll(script, { type: 'Literal' })) {
        if (typeof literal.value === 'string'
          && literal.value !== opts.replacement) {
          literal.value = opts.replacement;
          count++;
        }
      }
    }
    return count;
  },
};

const { run } = createVueMetamorphCli({
  plugins: [replaceStrings],
  additionalCliOptions(program) {
    program
      .option('--replace-strings', 'Replace string literals')
      .option('--replacement <value>', 'Text to use for string literals');
  },
});

run();
```

After building the CLI, apply the plugin to a sample file:

```bash
node dist/cli.js --files 'sample.js' \
    --replace-strings --replacement 'Hello, world!'
```

To read options outside a plugin, use the `opts()` method returned by
`createVueMetamorphCli()`. For option registration details, see the
[Commander.js options documentation](https://github.com/tj/commander.js?tab=readme-ov-file#options).

### Type your custom options

Undeclared properties on `opts` have type `unknown`. Narrow them with a runtime check,
as the example does for `replacement`, or declare their types through module augmentation.

Import from `vue-metamorph` before the declaration so that TypeScript augments the module:

```ts twoslash
import 'vue-metamorph';

declare module 'vue-metamorph' {
  interface PluginOptions {
    replaceStrings?: boolean;
    replacement?: string;
  }
}
```

These declarations apply to `opts` in every plugin's `transform()` and `find()` function.
Match the types to the Commander registrations: `--replace-strings` produces a boolean,
and `--replacement <value>` produces a string. Both properties can be `undefined` because
the options are optional. Module augmentation doesn't validate or convert runtime values.
