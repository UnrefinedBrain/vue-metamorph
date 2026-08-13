import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { TYPES_MODULE_ID, typeFilesModuleSource } from './type-files';

/**
 * The playground runs vue-metamorph's real parsers in the browser, which
 * means a handful of things have to be pointed somewhere else for the client
 * bundle.
 *
 * Two node built-ins are genuinely used: vue-eslint-parser calls
 * `path.extname()` to recognise an SFC and asserts on tokenizer invariants.
 * Both get a small browser implementation.
 *
 * Three packages are excluded outright. They sit behind code paths the
 * playground never takes, but a bundler hoists the `require()` that reaches them
 * and pulls in the entire dependency - all of eslint (~3.5 MB), all of stylus
 * and its Node-only image/file handling - so they are replaced by a module
 * that reports what happened if anything ever does reach them.
 */
const EXCLUDED_PACKAGES = [
  // vue-eslint-parser lazily requires eslint to build a SourceCode for custom
  // blocks. The playground reads ASTs; it never asks for one.
  'eslint',

  // recast only re-tokenizes with esprima under NODE_ENV=test, and esprima is
  // not a dependency of vue-metamorph.
  'esprima',

  // stylus is a Node program: its parser drags in the evaluator, which drags
  // in image sizing, `sax`, `glob` and a pile of file system access. Styles
  // written in stylus are reported as unsupported by the playground instead.
  'postcss-styl',
];

const shimPath = (name: string) => fileURLToPath(new URL(`./shims/${name}.ts`, import.meta.url));

const BROWSER_SHIMS: Record<string, string> = {
  assert: shimPath('assert'),
  path: shimPath('path'),
};

const EXCLUDED_PREFIX = '\0vue-metamorph:excluded:';

export const PLAYGROUND_MODULE_ID = 'virtual:vue-metamorph-playground';
const RESOLVED_PLAYGROUND_MODULE_ID = '\0vue-metamorph:playground';
const RESOLVED_TYPES_MODULE_ID = '\0vue-metamorph:types';

const playgroundEntry = () => fileURLToPath(new URL('./App.vue', import.meta.url));

/**
 * `src/vendor/deep-diff` is vendored verbatim as UMD. Rollup only converts
 * CommonJS inside node_modules, and the dev server does not convert it at all,
 * so the browser needs the module handed to it with an ESM shape.
 */
const UMD_VENDOR_MODULE = /\/src\/vendor\/deep-diff\/index\.js$/;

function wrapUmdModule(code: string) {
  return `const module = { exports: {} };\nconst exports = module.exports;\n${code}\nexport default module.exports;\n`;
}

function excludedModuleSource(packageName: string) {
  return `
const unavailable = () => {
  throw new Error(${JSON.stringify(packageName)} + ' is not bundled into the playground');
};

export const parse = unavailable;
export const tokenize = unavailable;
export const SourceCode = unavailable;
export const Linter = unavailable;

export default { parse, tokenize, SourceCode, Linter };
`;
}

const EXCLUDED_FILTER = new RegExp(`^(${EXCLUDED_PACKAGES.join('|')})$`);
const SHIM_FILTER = new RegExp(`^(node:)?(${Object.keys(BROWSER_SHIMS).join('|')})$`);
const EXCLUDED_NAMESPACE = 'vue-metamorph-excluded';

/**
 * The dev server pre-bundles dependencies with esbuild before any Vite plugin
 * sees them, so the same substitutions have to be handed to the optimizer.
 */
const dependencyOptimizerPlugin = {
  name: 'vue-metamorph:playground-deps',

  setup(build: {
    onResolve(options: { filter: RegExp }, callback: (args: { path: string }) => unknown): void;
    onLoad(
      options: { filter: RegExp; namespace: string },
      callback: (args: { path: string }) => unknown,
    ): void;
  }) {
    build.onResolve({ filter: SHIM_FILTER }, (args) => ({
      path: BROWSER_SHIMS[args.path.replace(/^node:/, '')],
    }));

    build.onResolve({ filter: EXCLUDED_FILTER }, (args) => ({
      path: args.path,
      namespace: EXCLUDED_NAMESPACE,
    }));

    build.onLoad({ filter: /.*/, namespace: EXCLUDED_NAMESPACE }, (args) => ({
      contents: excludedModuleSource(args.path),
      loader: 'js',
    }));
  },
};

/**
 * Vite plugin backing the in-docs playground.
 *
 * Everything here is scoped to the client build. The SSR pass renders pages in
 * Node at build time, where the real `path`, the real `eslint` and the real
 * `stylus` are all perfectly fine - and where the playground itself has no
 * business being evaluated at all, so it resolves to an empty component.
 */
export function playgroundPlugin(): Plugin {
  return {
    name: 'vue-metamorph:playground',
    enforce: 'pre',

    config() {
      return {
        optimizeDeps: {
          esbuildOptions: { plugins: [dependencyOptimizerPlugin] },
        },
      };
    },

    resolveId(source, _importer, options) {
      if (source === PLAYGROUND_MODULE_ID) {
        return options?.ssr ? RESOLVED_PLAYGROUND_MODULE_ID : playgroundEntry();
      }

      if (source === TYPES_MODULE_ID) {
        return RESOLVED_TYPES_MODULE_ID;
      }

      if (options?.ssr) {
        return null;
      }

      const bare = source.startsWith('node:') ? source.slice('node:'.length) : source;

      if (EXCLUDED_PACKAGES.includes(bare)) {
        return EXCLUDED_PREFIX + bare;
      }

      if (bare in BROWSER_SHIMS) {
        return BROWSER_SHIMS[bare];
      }

      return null;
    },

    load(id) {
      if (id === RESOLVED_PLAYGROUND_MODULE_ID) {
        return 'export default { render: () => null };';
      }

      if (id === RESOLVED_TYPES_MODULE_ID) {
        return typeFilesModuleSource();
      }

      if (id.startsWith(EXCLUDED_PREFIX)) {
        return excludedModuleSource(id.slice(EXCLUDED_PREFIX.length));
      }

      return null;
    },

    transform(code, id, options) {
      if (options?.ssr || !UMD_VENDOR_MODULE.test(id.replace(/\\/g, '/'))) {
        return null;
      }

      return { code: wrapUmdModule(code), map: null };
    },
  };
}
