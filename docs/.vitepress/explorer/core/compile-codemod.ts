/**
 * Turns the codemod editor's contents into a runnable plugin.
 *
 * The source is parsed with the same `@babel/parser` configuration codemods
 * are written against, then rewritten into something `new Function` accepts:
 * type annotations dropped, `vue-metamorph` imports bound to an injected
 * object, `export default` turned into a `return`, and loops fitted with a
 * guard so a runaway codemod cannot lock up the page.
 */

import * as recast from 'recast-x';
import { builders as b, namedTypes, visit } from 'ast-types-x';
import postcss from 'postcss';
import { parseTs } from '../../../../src/parse/typescript';
import { utils } from '../../../../src/types';

/** What `import { ... } from 'vue-metamorph'` resolves to inside the editor. */
export const vueMetamorphExports = {
  builders: utils.builders,
  astHelpers: utils.astHelpers,
  traverseScriptAST: utils.traverseScriptAST,
  traverseTemplateAST: utils.traverseTemplateAST,
  namedTypes,
  postcss,
};

const MODULE_ARGUMENT = '__vueMetamorph';
const GUARD_ARGUMENT = '__loopGuard';
const LOOP_TIMEOUT_MS = 5000;

/** Wrapper nodes that carry a type and nothing else at runtime. */
const TYPE_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'TypeCastExpression',
]);

/** Statements that vanish entirely once types are gone. */
const TYPE_DECLARATIONS = new Set([
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
  'TSDeclareFunction',
  'TSDeclareMethod',
  'TSAbstractMethodDefinition',
  'InterfaceDeclaration',
  'TypeAlias',
  'DeclareFunction',
  'DeclareModule',
]);

/** Per-node properties that only exist to describe types. */
const TYPE_PROPERTIES = [
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'superTypeParameters',
  'superTypeArguments',
  'implements',
  'accessibility',
  'abstract',
  'declare',
  'definite',
  'readonly',
  'override',
];

const LOOP_TYPES = new Set([
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
]);

type AnyNode = Record<string, unknown> & { type: string };

const isNode = (value: unknown): value is AnyNode =>
  !!value && typeof value === 'object' && typeof (value as AnyNode).type === 'string';

/**
 * Walks the tree, replacing each node with whatever `replace` returns.
 * Simpler than an ast-types visitor here because most of the work is deleting
 * properties rather than reshaping nodes.
 */
function transformTree(node: unknown, replace: (node: AnyNode) => AnyNode | null): unknown {
  if (Array.isArray(node)) {
    return node
      .map((child) => transformTree(child, replace))
      .filter((child) => child !== null && child !== undefined);
  }

  if (!isNode(node)) {
    return node;
  }

  const replaced = replace(node);
  if (!replaced) {
    return null;
  }

  for (const key of Object.keys(replaced)) {
    if (key === 'loc' || key === 'range' || key === 'original') {
      continue;
    }

    const value = transformTree(replaced[key], replace);
    if (value === null && isNode(replaced[key])) {
      delete replaced[key];
    } else {
      replaced[key] = value;
    }
  }

  return replaced;
}

function stripTypes(program: namedTypes.Program): void {
  transformTree(program, (node) => {
    if (TYPE_DECLARATIONS.has(node.type)) {
      return null;
    }

    if (TYPE_WRAPPERS.has(node.type) && isNode(node.expression)) {
      return node.expression;
    }

    if (node.type === 'TSParameterProperty' && isNode(node.parameter)) {
      return node.parameter;
    }

    if (node.type === 'ImportDeclaration' && node.importKind === 'type') {
      return null;
    }

    if (node.type === 'ImportSpecifier' && node.importKind === 'type') {
      return null;
    }

    if (node.type === 'TSEnumDeclaration') {
      throw new Error('TypeScript enums are not supported in the explorer, use a plain object');
    }

    for (const property of TYPE_PROPERTIES) {
      delete node[property];
    }

    // `foo?: string` and `foo!: string` both print their marker from a flag.
    if (node.type === 'Identifier' || node.type === 'ObjectPattern') {
      node.optional = false;
    }

    return node;
  });
}

function importToBinding(node: namedTypes.ImportDeclaration): namedTypes.VariableDeclaration {
  const source = node.source.value;

  if (source !== 'vue-metamorph') {
    throw new Error(
      `Only 'vue-metamorph' can be imported here, but the codemod imports '${String(source)}'`,
    );
  }

  const specifiers = node.specifiers ?? [];
  const namespace = specifiers.find((specifier) => specifier.type === 'ImportNamespaceSpecifier');

  if (namespace) {
    return b.variableDeclaration('const', [
      b.variableDeclarator(
        b.identifier(namespace.local!.name as string),
        b.identifier(MODULE_ARGUMENT),
      ),
    ]);
  }

  const properties = specifiers.map((specifier) => {
    if (specifier.type !== 'ImportSpecifier') {
      throw new Error('vue-metamorph has no default export, use a named import');
    }

    const imported = b.identifier(specifier.imported.name as string);
    const local = b.identifier((specifier.local ?? specifier.imported).name as string);
    const property = b.property('init', imported, local);
    property.shorthand = imported.name === local.name;
    return property;
  });

  return b.variableDeclaration('const', [
    b.variableDeclarator(b.objectPattern(properties), b.identifier(MODULE_ARGUMENT)),
  ]);
}

/**
 * Rewrites module syntax into statements that can run inside a function body,
 * and reports what the module exported by way of a trailing `return`.
 */
function rewriteModuleSyntax(program: namedTypes.Program): void {
  const body: namedTypes.Statement[] = [];
  let exported: namedTypes.Expression | null = null;

  for (const statement of program.body) {
    switch (statement.type) {
      case 'ImportDeclaration':
        body.push(importToBinding(statement));
        break;

      case 'ExportDefaultDeclaration': {
        const declaration = statement.declaration;

        if (
          (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') &&
          declaration.id
        ) {
          body.push(declaration as unknown as namedTypes.Statement);
          exported = b.identifier(declaration.id.name as string);
        } else {
          exported = declaration as namedTypes.Expression;
        }
        break;
      }

      case 'ExportNamedDeclaration':
        if (statement.declaration) {
          body.push(statement.declaration as unknown as namedTypes.Statement);
        }
        break;

      case 'ExportAllDeclaration':
        break;

      default:
        body.push(statement);
    }
  }

  if (!exported) {
    throw new Error('The codemod needs to `export default` a CodemodPlugin');
  }

  body.push(b.returnStatement(exported));
  program.body = body;
}

/**
 * Calls a guard on every loop iteration. Without it, a `while (true)` in the
 * editor takes the whole tab with it.
 */
function protectFromLoops(program: namedTypes.Program): void {
  visit(program, {
    visitStatement(path) {
      const node = path.node;

      if (!LOOP_TYPES.has(node.type)) {
        this.traverse(path);
        return;
      }

      const loop = node as unknown as { body: namedTypes.Statement };
      const guard = b.expressionStatement(
        b.callExpression(b.identifier(GUARD_ARGUMENT), [b.literal(node.loc?.start.line ?? 0)]),
      );

      if (loop.body.type === 'BlockStatement') {
        (loop.body as namedTypes.BlockStatement).body.unshift(guard);
      } else {
        loop.body = b.blockStatement([guard, loop.body]);
      }

      this.traverse(path);
    },
  });
}

function createLoopGuard() {
  const deadline = Date.now() + LOOP_TIMEOUT_MS;

  return (line: number) => {
    if (Date.now() > deadline) {
      throw new Error(`Infinite loop detected on line ${line} of the codemod`);
    }
  };
}

/**
 * Compiles the codemod source and returns whatever it exports, which should be
 * a CodemodPlugin (or a list of them).
 */
export function compileCodemod(source: string): unknown {
  const program = parseTs(source, true);

  stripTypes(program);
  rewriteModuleSyntax(program);
  protectFromLoops(program);

  // Printed from scratch: the rewrite above touches most of the tree, and the
  // formatting of code that is about to be eval'd is nobody's concern.
  const compiled = recast.prettyPrint(program, { tabWidth: 2, quote: 'single' }).code;

  // eslint-disable-next-line no-new-func
  const factory = new Function(MODULE_ARGUMENT, GUARD_ARGUMENT, compiled);

  return factory(vueMetamorphExports, createLoopGuard());
}
