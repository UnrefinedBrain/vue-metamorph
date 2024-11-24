import { visit } from 'ast-types-x';
import * as babelParser from '@babel/parser';
import * as recast from 'recast-x';
import { VueProgram } from '../types';

const babelOptions = (isJsx: boolean): babelParser.ParserOptions => ({
  strictMode: false,
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  startLine: 1,
  tokens: true,
  ranges: true,
  sourceType: 'module',
  plugins: [
    'asyncGenerators',
    'bigInt',
    'classPrivateMethods',
    'classPrivateProperties',
    'classProperties',
    'classStaticBlock',
    'decorators-legacy',
    'doExpressions',
    'dynamicImport',
    'estree',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'functionBind',
    'functionSent',
    'importMeta',
    'nullishCoalescingOperator',
    'numericSeparator',
    'objectRestSpread',
    'optionalCatchBinding',
    'optionalChaining',
    [
      'pipelineOperator',
      {
        proposal: 'fsharp',
      },
    ],
    [
      'recordAndTuple',
    ],
    'throwExpressions',
    'topLevelAwait',
    'typescript',
    'v8intrinsic',

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...isJsx ? ['jsx'] as any[] : [],
  ],
});

export const tsParser = (isJsx: boolean) => ({
  parse: (code: string): babelParser.File => babelParser.parse(code, babelOptions(isJsx)),
  parseForESLint: (code: string): { ast: babelParser.File['program'] } => {
    const res = babelParser.parse(code, babelOptions(isJsx));

    // needed to avoid vue-eslint-parser error
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
      // @ts-expect-error Needed by vue-eslint-parser
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
 * Parse JS or TS code
 * @param code Source code
 * @returns AST
 */
export function parseTs(code: string, isJsx: boolean) {
  const ast = recast.parse(code, {
    parser: tsParser(isJsx),
  }).program as VueProgram;

  ast.isScriptSetup = false;

  return ast;
}
