import postcss from 'postcss';
import * as AST from './ast';
import { parseTs, parseVue } from './parse';
import { ManualMigrationPlugin, ReportFunction, VueProgram, utils } from './types';
import { getCssDialectForFilename, parseCss } from './parse/css';

type SampleArgs = {
  /**
   * The full text of the source code.
   */
  code: string;

  /**
   * The 1-based index of the first line to highlight.
   */
  lineStart: number;

  /**
   * The 1-based index of the first column to highlight.
   */
  columnStart: number;

  /**
   * The 1-based index of the last line to highlight.
   */
  lineEnd: number;

  /**
   * The 1-based index of the last column to highlight.
   */
  columnEnd: number;

  /**
   * The number of extra lines to include before the first line and after the last line.
   */
  extraLines: number;
};

const spaces = (n: number) => ' '.repeat(n);
const carets = (n: number) => '^'.repeat(n);

/**
 * Extracts a code sample with carets that point at a range in the source.
 * @param args - The source code and the range to highlight.
 * @returns The formatted code sample.
 */
export function sample({
  code,
  columnEnd,
  columnStart,
  lineEnd,
  lineStart,
  extraLines: extra,
}: SampleArgs): string {
  const codeLines = code.split('\n');

  const firstLineNumber = Math.max(0, lineStart - extra - 1);
  const lastLineNumber = Math.min(codeLines.length, lineEnd + extra);
  const snippet = codeLines.slice(firstLineNumber, lastLineNumber);

  const prefix = (n?: number) =>
    `${String(n ?? '').padStart(String(lastLineNumber).length, ' ')} | `;

  const lines: string[] = [];

  for (let i = 0; i < snippet.length; i++) {
    const line = snippet[i]!;
    const lineNumber = firstLineNumber + i + 1;

    lines.push(prefix(lineNumber) + line);

    if (lineNumber === lineStart && lineNumber === lineEnd) {
      lines.push(prefix() + spaces(columnStart - 1) + carets(columnEnd - columnStart + 1));
    } else if (lineNumber === lineStart) {
      lines.push(prefix() + spaces(columnStart - 1) + carets(line.length - columnStart + 1));
    } else if (lineNumber < lineEnd && lineNumber > lineStart) {
      lines.push(prefix() + carets(Math.max(line.length, 1)));
    } else if (lineNumber === lineEnd) {
      lines.push(prefix() + carets(columnEnd));
    }
  }

  return lines.join('\n');
}

/**
 * A manual migration that a `ManualMigrationPlugin` reported.
 * @public
 */
export type ManualMigrationReport = {
  /**
   * The migration message.
   */
  message: string;

  /**
   * The name of the file that holds the node.
   */
  file: string;

  /**
   * A code snippet that highlights the node.
   */
  snippet: string;

  /**
   * The name of the plugin that reported this migration.
   */
  pluginName: string;

  /**
   * The 1-based index of the first line of the node.
   */
  lineStart: number;

  /**
   * The 1-based index of the last line of the node.
   */
  lineEnd: number;

  /**
   * The 1-based index of the first column of the node, on the first line.
   */
  columnStart: number;

  /**
   * The 1-based index of the last column of the node, on the last line.
   */
  columnEnd: number;
};

/**
 * Runs manual migration plugins against source code and returns reports that identify the nodes
 * that need human attention. This function doesn't change the code.
 *
 * @example
 * ```ts
 * import { findManualMigrations, type ManualMigrationPlugin } from 'vue-metamorph';
 *
 * const plugin: ManualMigrationPlugin = {
 *   type: 'manual',
 *   name: 'find-deprecated-api',
 *   find({ scriptASTs, report, utils: { traverseScriptAST } }) {
 *     for (const ast of scriptASTs) {
 *       traverseScriptAST(ast, {
 *         visitCallExpression(path) {
 *           if (path.node.callee.type === 'Identifier'
 *             && path.node.callee.name === 'deprecatedFn') {
 *             report(path.node, 'Replace deprecatedFn with newFn');
 *           }
 *           return this.traverse(path);
 *         },
 *       });
 *     }
 *   },
 * };
 *
 * const reports = findManualMigrations(code, 'file.vue', [plugin]);
 * // Each report: { message, file, snippet, pluginName, lineStart, lineEnd, columnStart, columnEnd }
 * ```
 *
 * @param code - The source code.
 * @param filename - The name of the file. vue-metamorph selects a parser based on this name.
 * @param plugins - The manual migration plugins to run.
 * @param opts - Extra options to pass through to the plugins.
 * @returns An array of reports. Each report identifies a node and carries a message.
 * @public
 */
export function findManualMigrations(
  code: string,
  filename: string,
  plugins: ManualMigrationPlugin[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Record<string, any> = {},
): ManualMigrationReport[] {
  const reports: ManualMigrationReport[] = [];

  let scripts: VueProgram[] = [];
  let template: AST.VDocumentFragment | null = null;
  let styles: postcss.Root[] = [];

  if (filename.endsWith('.vue')) {
    const { scriptASTs: scriptAsts, sfcAST: vueAst, styleASTs } = parseVue(code);
    scripts = scriptAsts;
    template = vueAst.templateBody!.parent as unknown as AST.VDocumentFragment;
    styles = styleASTs;
  } else if (getCssDialectForFilename(filename)) {
    styles = [parseCss(code, getCssDialectForFilename(filename)!)];
  } else {
    scripts = [parseTs(code, /\.[jt]sx$/.test(filename))];
  }

  for (const plugin of plugins) {
    const report: ReportFunction = (node, message) => {
      if ('loc' in node) {
        if (node.loc) {
          const snippet = sample({
            code,
            extraLines: 3,
            lineStart: node.loc.start.line,
            lineEnd: node.loc.end.line,
            columnStart: node.loc.start.column + 1,
            columnEnd: node.loc.end.column,
          });

          reports.push({
            message,
            file: filename,
            snippet,
            pluginName: plugin.name,
            lineStart: node.loc.start.line,
            lineEnd: node.loc.end.line,
            columnStart: node.loc.start.column + 1,
            columnEnd: node.loc.end.column,
          });
        } else if ('range' in node && Array.isArray(node.range)) {
          // The parser didn't attach loc information, so compute the position from the range.
          const [start, end] = node.range;

          const before = code.slice(0, start);
          const middle = code.slice(start, end);

          const lineStart = (before.match(/\n/g)?.length ?? 0) + 1;
          const columnStart = start - before.lastIndexOf('\n');

          const lineEnd = lineStart + (middle.match(/\n/g)?.length ?? 0);
          const columnEnd = end - code.slice(0, end).lastIndexOf('\n') - 1;

          const snippet = sample({
            code,
            extraLines: 3,
            lineStart,
            lineEnd,
            columnStart,
            columnEnd,
          });

          reports.push({
            message,
            file: filename,
            snippet,
            pluginName: plugin.name,
            lineStart,
            lineEnd,
            columnStart,
            columnEnd,
          });
        }

        return;
      }

      if ('positionInside' in node) {
        const { line: lineStart, column: columnStart } = node.source!.start!;
        const { line: lineEnd, column: columnEnd } = node.source!.end!;
        const snippet = sample({
          code,
          extraLines: 3,
          lineStart,
          lineEnd,
          columnStart,
          columnEnd: columnEnd - 1,
        });

        reports.push({
          message,
          file: filename,
          snippet,
          pluginName: plugin.name,
          lineStart,
          lineEnd,
          columnStart,
          columnEnd: columnEnd - 1,
        });

        return;
      }

      throw new Error(`Node type ${node.type} is missing location information`);
    };

    plugin.find({
      scriptASTs: scripts,
      sfcAST: template,
      styleASTs: styles,
      filename,
      report,
      utils,
      opts,
    });
  }

  return reports;
}
