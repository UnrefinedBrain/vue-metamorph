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

To attach extra options to your vue-metamorph CLI, use the `additionalCliOptions` property. For
more information about the `.option()` and `.requiredOption()` functions, see the
[Commander.js options documentation](https://github.com/tj/commander.js?tab=readme-ov-file#options).

vue-metamorph passes the parsed options to the `transform()` function of each CodemodPlugin and
the `find()` function of each ManualMigrationPlugin, as the `opts` parameter.

```ts

const myCodemod: CodemodPlugin = {
  name: 'myCodemod',
  type: 'codemod',
  transform({ opts }) {
    if (opts.myCustomOption) {
      // do something
    } else {
      // do something else
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
      .option('--some-other-option <value>');
  }
});

// to read the options outside of a codemod or manual migration, call opts()
if (opts().myCustomOption) {
  console.error('do not use this option');
  process.exit(1);
}

```

### Type your custom options

Because the options you register aren't known ahead of time, every key on `opts` reads as
`unknown`. That's enough to check whether an option is set:

```ts
if (opts.myCustomOption) {
  // do something
}
```

To give an option a declared type, augment the `PluginOptions` interface. Every
`transform()` and `find()` function then uses that declaration. You can also narrow an
undeclared option with a check such as `typeof opts.someOtherOption === 'string'`.

Match each declaration to its Commander registration. A flag such as `--my-custom-option`
produces a boolean. The `<value>` argument in `--some-other-option <value>` produces a string.
Both options are optional, so their properties can be `undefined`. Module augmentation
doesn't validate or convert values at runtime.

Import from `vue-metamorph` before the declaration so that TypeScript augments the module:

```ts
import type { CodemodPlugin } from 'vue-metamorph';

declare module 'vue-metamorph' {
  interface PluginOptions {
    myCustomOption?: boolean;
    someOtherOption?: string;
  }
}

const myCodemod: CodemodPlugin = {
  name: 'myCodemod',
  type: 'codemod',
  transform({ opts }) {
    // The value is a string when --some-other-option is supplied.
    return opts.someOtherOption?.length ?? 0;
  }
};
```
