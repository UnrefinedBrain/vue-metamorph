import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Collects the `.d.ts` files the codemod editor needs to type check against,
 * keyed by the path the in-browser language service will look them up under.
 *
 * The set is whatever TypeScript itself pulls in for `import 'vue-metamorph'`,
 * which keeps it honest: the editor checks against the declarations the
 * published package ships, not a hand-maintained copy.
 */

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DECLARATIONS = join(REPO_ROOT, 'dist/vue-metamorph.d.ts');

/**
 * Types reachable only through the CLI half of the API, which nobody writes
 * inside a codemod. `@types/node` alone is 2.2 MB. `skipLibCheck` keeps their
 * absence from turning into errors in the editor.
 */
const PRUNED_PACKAGES = new Set([
  '@types/cli-progress',
  '@types/lodash',
  '@types/lodash-es',
  '@types/node',
  '@types/picomatch',
  'commander',
  'undici-types',
]);

export const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  // A scratch pad should not nag about parameters whose types are obvious from
  // the plugin interface the moment the author annotates the object.
  noImplicitAny: false,
  skipLibCheck: true,
  noEmit: true,
};

/** Splits a resolved path into its package name and the path within it. */
function toPackagePath(fileName: string): { pkg: string; subpath: string } | null {
  const index = fileName.lastIndexOf('/node_modules/');
  if (index === -1) {
    return null;
  }

  const after = fileName.slice(index + '/node_modules/'.length);
  const segments = after.split('/');
  const pkg = after.startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0]!;

  return { pkg, subpath: after.slice(pkg.length + 1) };
}

/** The fields TypeScript reads when resolving a package. */
function manifestFor(packageRoot: string): string | null {
  const manifest = join(packageRoot, 'package.json');
  if (!existsSync(manifest)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, unknown>;

  return JSON.stringify({
    name: parsed.name,
    version: parsed.version,
    types: parsed.types ?? parsed.typings,
    main: parsed.main,
    module: parsed.module,
    exports: parsed.exports,
    typesVersions: parsed.typesVersions,
  });
}

/**
 * Returns a virtual file system of declaration files, or null when the package
 * has not been built yet - `pnpm docs:dev` builds it first, but a bare
 * `vitepress dev docs` does not, and the explorer should still come up.
 */
export function collectTypeFiles(): Record<string, string> | null {
  if (!existsSync(DECLARATIONS)) {
    return null;
  }

  // Never written to disk: the host below answers for it.
  const probe = join(REPO_ROOT, '__codemod-types-probe.ts');
  const probeSource = "import 'vue-metamorph';\n";

  const host = ts.createCompilerHost(COMPILER_OPTIONS, true);
  const readFile = host.readFile.bind(host);
  host.readFile = (name) => (name === probe ? probeSource : readFile(name));
  host.fileExists = (name) => name === probe || existsSync(name);

  const program = ts.createProgram([probe], COMPILER_OPTIONS, host);

  const files: Record<string, string> = {};
  const packageRoots = new Set<string>();

  for (const source of program.getSourceFiles()) {
    const name = source.fileName;

    const lib = /\/typescript\/lib\/(lib\..*\.d\.ts)$/.exec(name);
    if (lib) {
      files[`/${lib[1]}`] = source.text;
      continue;
    }

    const packagePath = toPackagePath(name);
    if (!packagePath) {
      if (name === DECLARATIONS.replace(/\\/g, '/')) {
        files['/node_modules/vue-metamorph/dist/vue-metamorph.d.ts'] = source.text;
      }
      continue;
    }

    if (PRUNED_PACKAGES.has(packagePath.pkg)) {
      continue;
    }

    files[`/node_modules/${packagePath.pkg}/${packagePath.subpath}`] = source.text;
    packageRoots.add(
      name.slice(0, name.lastIndexOf('/node_modules/')) + `/node_modules/${packagePath.pkg}`,
    );
  }

  for (const root of packageRoots) {
    const manifest = manifestFor(root);
    const name = toPackagePath(`${root}/package.json`)?.pkg;
    if (manifest && name) {
      files[`/node_modules/${name}/package.json`] = manifest;
    }
  }

  files['/node_modules/vue-metamorph/package.json'] = JSON.stringify({
    name: 'vue-metamorph',
    types: 'dist/vue-metamorph.d.ts',
  });

  return files;
}

export const TYPES_MODULE_ID = 'virtual:vue-metamorph-types';

export function typeFilesModuleSource(): string {
  const files = collectTypeFiles();

  // Parsing one JSON string beats parsing a megabyte of object literal.
  return `export const TYPE_FILES = ${
    files ? `JSON.parse(${JSON.stringify(JSON.stringify(files))})` : 'null'
  };\n`;
}
