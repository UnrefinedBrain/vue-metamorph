
import { visit } from 'ast-types';
import * as babelParser from '@babel/parser';
import { File } from '@babel/types';
import * as recast from 'recast';
import { VueProgram } from '../types';


const babelOptions = (isJsx: boolean): babelParser.ParserOptions => ({
  sourceType: 'module',
  strictMode: false,
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  startLine: 1,
  tokens: true,
  plugins: [
    'asyncGenerators',
    'bigInt',
    'classPrivateMethods',
    'classPrivateProperties',
    'classProperties',
    'classStaticBlock',
    'decimal',
    'decorators-legacy',
    'doExpressions',
    'dynamicImport',
    'estree',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'functionBind',
    'functionSent',
    'importAssertions',
    'importMeta',
    'nullishCoalescingOperator',
    'numericSeparator',
    'objectRestSpread',
    'optionalCatchBinding',
    'optionalChaining',
    [
      'pipelineOperator',
      {
        proposal: 'minimal',
      },
    ],
    [
      'recordAndTuple',
      {
        syntaxType: 'hash',
      },
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
  parse: (code: string): babelParser.ParseResult<File> => babelParser.parse(code, babelOptions(isJsx)),
  parseForESLint: (code: string) => {
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
