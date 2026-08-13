/**
 * A TypeScript language service for the codemod editor.
 *
 * It checks against the declarations vue-metamorph publishes, so the editor
 * knows what a `CodemodPlugin` is, what `sfcAST` holds, and which builders
 * exist - the same answers the compiler would give in a real codemod project.
 *
 * TypeScript is passed in rather than imported: in the browser it arrives
 * through a dynamic import, and the tests hand over the local copy.
 */

import type TS from 'typescript';

/** Where the editor's contents live in the virtual file system. */
const CODEMOD_FILE = '/codemod.ts';

export type Diagnostic = {
  from: number;
  to: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export type CompletionEntry = {
  label: string;
  kind: string;
  /** Sort order handed down by TypeScript. */
  sortText: string;
  detail?: () => Promise<string | undefined>;
};

export type QuickInfo = {
  from: number;
  to: number;
  signature: string;
  documentation: string;
};

export type CodemodLanguageService = {
  update(code: string): void;
  getDiagnostics(): Diagnostic[];
  getCompletions(position: number): CompletionEntry[];
  getQuickInfo(position: number): QuickInfo | null;
};

export function createCodemodLanguageService(
  ts: typeof TS,
  files: Record<string, string>,
): CodemodLanguageService {
  const sources = new Map(Object.entries(files));
  let version = 0;

  sources.set(CODEMOD_FILE, '');

  const options: TS.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts'],
    strict: true,
    // The plugin interface supplies the types that matter; a scratch pad
    // should not nag about the rest.
    noImplicitAny: false,
    skipLibCheck: true,
    allowJs: false,
    noEmit: true,
  };

  const host: TS.LanguageServiceHost = {
    getScriptFileNames: () => [CODEMOD_FILE],
    getScriptVersion: (fileName) => (fileName === CODEMOD_FILE ? String(version) : '1'),
    getScriptSnapshot(fileName) {
      const text = sources.get(fileName);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => options,
    getDefaultLibFileName: (settings) => `/${ts.getDefaultLibFileName(settings)}`,
    fileExists: (fileName) => sources.has(fileName),
    readFile: (fileName) => sources.get(fileName),
    readDirectory: () => [],
    getDirectories: () => [],
    directoryExists(directory) {
      const prefix = directory.endsWith('/') ? directory : `${directory}/`;
      for (const fileName of sources.keys()) {
        if (fileName.startsWith(prefix)) {
          return true;
        }
      }
      return false;
    },
  };

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  const severityOf = (category: TS.DiagnosticCategory): Diagnostic['severity'] => {
    switch (category) {
      case ts.DiagnosticCategory.Error:
        return 'error';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      default:
        return 'info';
    }
  };

  return {
    update(code) {
      if (sources.get(CODEMOD_FILE) !== code) {
        sources.set(CODEMOD_FILE, code);
        version += 1;
      }
    },

    getDiagnostics() {
      const length = sources.get(CODEMOD_FILE)?.length ?? 0;

      return [
        ...service.getSyntacticDiagnostics(CODEMOD_FILE),
        ...service.getSemanticDiagnostics(CODEMOD_FILE),
      ].map((diagnostic) => {
        const from = Math.min(diagnostic.start ?? 0, length);
        return {
          from,
          to: Math.min(from + (diagnostic.length || 1), length),
          severity: severityOf(diagnostic.category),
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        };
      });
    },

    getCompletions(position) {
      const completions = service.getCompletionsAtPosition(CODEMOD_FILE, position, {
        includeCompletionsForModuleExports: false,
        includeCompletionsWithInsertText: false,
      });

      return (completions?.entries ?? []).map((entry) => ({
        label: entry.name,
        kind: entry.kind,
        sortText: entry.sortText,
        detail: async () => {
          const details = service.getCompletionEntryDetails(
            CODEMOD_FILE,
            position,
            entry.name,
            undefined,
            undefined,
            undefined,
            undefined,
          );

          if (!details) {
            return undefined;
          }

          const signature = ts.displayPartsToString(details.displayParts);
          const documentation = ts.displayPartsToString(details.documentation);
          return documentation ? `${signature}\n\n${documentation}` : signature;
        },
      }));
    },

    getQuickInfo(position) {
      const info = service.getQuickInfoAtPosition(CODEMOD_FILE, position);
      if (!info) {
        return null;
      }

      return {
        from: info.textSpan.start,
        to: info.textSpan.start + info.textSpan.length,
        signature: ts.displayPartsToString(info.displayParts),
        documentation: ts.displayPartsToString(info.documentation),
      };
    },
  };
}
