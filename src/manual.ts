import postcss from 'postcss';
import * as AST from './ast';
import { parseTs, parseVue } from './parse';
import {
  ManualMigrationPlugin, ReportFunction, VueProgram, utils,
} from './types';
import { parseCss } from './parse/css';

type SampleArgs = {
  /**
   * Full text of the source code
   */
  code: string;

  /**
   * 1-based index of the starting line to highlight
   */
  lineStart: number;

  /**
   * 1-based index of the starting column to highlight
   */
  columnStart: number;

  /**
   * 1-based index of the ending line to highlight
   */
  lineEnd: number;

  /**
   * 1-based index of the ending column to highlight
   */
  columnEnd: number;

  /**
   * number of extra lines to include on either side of the starting/ending lines
   */
  extraLines: number;
};

const spaces = (n: number) => ' '.repeat(n);
const carets = (n: number) => '^'.repeat(n);

/**
 * Extracts a code sample with carets pointing to specific locations
 * @param args Arguments
 * @returns formatted code sample
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

  const prefix = (n?: number) => `${String(n ?? '').padStart(String(lastLineNumber).length, ' ')} | `;

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
 * An object containing a manual migration that a ManualMigrationPlugin reported
 * @public
 */
export type ManualMigrationReport = {
  /**
   * Migration message
   */
  message: string;

  /**
   * The filename
   */
  file: string;

  /**
   * Code snippet highlighting the node
   */
  snippet: string;

  /**
   * The plugin that generated this report
   */
  pluginName: string;

  /**
   * 1-based index of the starting line number
   */
  lineStart: number;

  /**
   * 1-based index of the ending line number
   */
  lineEnd: number;

  /**
   * 1-based index of the starting column number on the starting line
   */
  columnStart: number;

  /**
   * 1-based index of the enging column number on the ending line
   */
  columnEnd: number;
};

/**
 * Finds manual migration locations in a file
 * @param code - Source code
 * @param filename - The file name
 * @param plugins - Manual migration plugins
 * @param opts - CLI Options
 * @returns List of reports
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
    template = vueAst.templateBody!.parent as AST.VDocumentFragment;
    styles = styleASTs;
  } else if (filename.endsWith('.css')) {
    styles = [parseCss(code, 'css')];
  } else if (filename.endsWith('.less')) {
    styles = [parseCss(code, 'less')];
  } else if (filename.endsWith('.sass')) {
    styles = [parseCss(code, 'sass')];
  } else if (filename.endsWith('.scss')) {
    styles = [parseCss(code, 'scss')];
  } else {
    scripts = [parseTs(code, /\.[jt]sx$/.test(filename))];
  }

  for (const plugin of plugins) {
    const report: ReportFunction = (node, message) => {
      if ('loc' in node && node.loc) {
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

        return;
      }

      if ('positionInside' in node) {
        const endIndex = node.toString().length;
        const startLoc = node.positionInside(0);
        const endLoc = node.positionInside(endIndex);

        const snippet = sample({
          code,
          extraLines: 3,
          lineStart: startLoc.line,
          lineEnd: endLoc.line,
          columnStart: startLoc.column,
          columnEnd: endLoc.column - 1,
        });

        reports.push({
          message,
          file: filename,
          snippet,
          pluginName: plugin.name,
          lineStart: startLoc.line,
          lineEnd: endLoc.line,
          columnStart: startLoc.column,
          columnEnd: endLoc.column - 1,
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
