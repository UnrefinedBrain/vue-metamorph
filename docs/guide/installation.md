# Installation

There are two ways to use vue-metamorph. You can use the scaffolding tool to create a
vue-metamorph CLI project, or you can import vue-metamorph into an app or library that you
already have.

## Scaffold and run a codemod project

The scaffolding command copies a sample project. The generated CLI runs your plugins.
To create the project and try its sample plugin, follow these steps:

1. Create the project and install its dependencies:

   ```bash
   npx vue-metamorph my-codemod-name
   cd my-codemod-name
   npm install
   ```

2. Open `src/plugins/hello-world.ts` to inspect the sample plugin. It replaces script
   string literals with `Hello, world!`. The `src/main.ts` file registers the plugin.

3. Create a file named `sample.js` in the project directory with this content:

   ```js
   const message = 'Goodbye';
   ```

4. Build the CLI and check that the plugin is registered:

   ```bash
   npm run build
   node dist/cli.js --list-plugins
   ```

   The output includes `hello-world`. Rebuild after changing a plugin or its registration.

5. Run the plugin on the sample file:

   ```bash
   node dist/cli.js --files 'sample.js' --plugins 'hello-world'
   ```

   The CLI writes changes directly to matching files. After this command, `sample.js`
   contains:

   ```js
   const message = 'Hello, world!';
   ```

To apply the CLI to your own project, replace `'sample.js'` with a quoted file pattern,
such as `'../my-app/src/**/*.vue'`. Relative patterns start from your terminal's working
directory. Review the plugin before running it on your source files.

For plugin authoring, see [Write a codemod](./writing-codemods.md). For runner options,
see [Command-line interface](./cli.md).

## Install vue-metamorph in an existing package

To add vue-metamorph to a package that you already have, install it as a development dependency:

```bash
# npm
npm install -D vue-metamorph

# yarn
yarn add -D vue-metamorph

# pnpm
pnpm add -D vue-metamorph
```
