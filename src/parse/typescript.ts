import { visit } from '../vendor/ast-types/main';
import * as babelParser from '@babel/parser';
import * as recast from '../vendor/recast/main';
import { VueProgram } from '../types';

const babelOptions = (isJsx: boolean): babelParser.ParserOptions => ({
  strictMode: false,
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  startLine: 1,
  errorRecovery: true,
  tokens: true,
  ranges: true,
  sourceType: 'module',
  plugins: [
    'decorators-legacy',
    'doExpressions',
    'estree',
    'exportDefaultFrom',
    'functionBind',
    'functionSent',
    [
      'pipelineOperator',
      {
        proposal: 'fsharp',
      },
    ],
    'throwExpressions',
    'typescript',
    'v8intrinsic',

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(isJsx ? (['jsx'] as any[]) : []),
  ],
});

export const tsParser = (isJsx: boolean) => ({
  parse: (code: string): babelParser.File => babelParser.parse(code, babelOptions(isJsx)),
  parseForESLint: (code: string): { ast: babelParser.File['program'] } => {
    const res = babelParser.parse(code, babelOptions(isJsx));

    visit(res.program, {
      visitNode(path) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = path.node as any;
        if (!node.range) {
          node.range = [node.start, node.end];
        }

        this.traverse(path);
      },
    });

    res.tokens?.forEach((tok) => {
      tok.range = [tok.start, tok.end];
    });

    // @ts-expect-error Needed by vue-eslint-parser
    res.program.tokens = res.tokens;

    // @ts-expect-error Needed by vue-eslint-parser
    res.program.comments = res.comments;

    return {
      ast: res.program,
    };
  },
});

/**
 * Parses JavaScript or TypeScript source code.
 * @param code - The source code.
 * @param isJsx - Whether to parse the code as JSX.
 * @returns The script AST.
 */
export function parseTs(code: string, isJsx: boolean) {
  const ast = recast.parse(code, {
    parser: tsParser(isJsx),
  }).program as VueProgram;

  ast.isScriptSetup = false;

  return ast;
}
