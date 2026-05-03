import { builders, namedTypes, visit } from 'ast-types-x';
import { isMatch } from 'lodash-es';
import * as AST from './ast';

type Matcher<T> = T extends { type: string }
  ? {
      [key in Exclude<keyof T, 'type' | 'comments' | 'loc' | 'range'>]?: NonNullable<
        T[key]
      > extends (infer A)[]
        ? Matcher<A>[]
        : Matcher<T[key]>;
    } & { type: T['type'] }
  : T;

/**
 * Finds the first node in an AST that matches a partial node using deep partial matching.
 * Works with both script ASTs (ESTree) and template ASTs (vue-eslint-parser).
 *
 * @example
 * ```ts
 * // Find the first <div> in the template
 * const div = findFirst(sfcAST, { type: 'VElement', name: 'div' });
 *
 * // Find the first console.log call in a script
 * const log = findFirst(scriptAST, {
 *   type: 'CallExpression',
 *   callee: {
 *     type: 'MemberExpression',
 *     object: { type: 'Identifier', name: 'console' },
 *     property: { type: 'Identifier', name: 'log' },
 *   },
 * });
 * ```
 *
 * @param ast - The node to traverse
 * @param matcher - Partial object to match against (uses lodash isMatch)
 * @returns The first matching node, or null if no matching node was found
 * @public
 */
export function findFirst<M extends Matcher<namedTypes.ASTNode | AST.Node>>(
  ast: AST.Node | namedTypes.ASTNode,
  matcher: M,
): (AST.Node & { type: M['type'] }) | null {
  let matchingNode: AST.Node | namedTypes.Node | null = null;

  if (ast.type.startsWith('V')) {
    AST.traverseNodes(ast as AST.Node, {
      enterNode(node) {
        if (!matchingNode && isMatch(node, matcher)) {
          matchingNode = node;
        }
      },
      leaveNode() {
        // empty
      },
    });
  } else {
    visit(ast, {
      visitNode(path) {
        if (!matchingNode && isMatch(path.node, matcher)) {
          matchingNode = path.node;
          return this.abort();
        }

        return this.traverse(path);
      },
    });
  }

  return matchingNode;
}

/**
 * Finds all nodes in an AST that match a partial node using deep partial matching.
 * Works with both script ASTs (ESTree) and template ASTs (vue-eslint-parser).
 *
 * @example
 * ```ts
 * // Find all <MyComponent> elements in the template
 * const els = findAll(sfcAST, { type: 'VElement', name: 'MyComponent' });
 *
 * // Find all v-if directives
 * const vIfs = findAll(sfcAST, {
 *   type: 'VAttribute',
 *   directive: true,
 *   key: { type: 'VDirectiveKey', name: { name: 'if' } },
 * });
 *
 * // Find all call expressions in a script
 * const calls = findAll(scriptAST, { type: 'CallExpression' });
 * ```
 *
 * @param ast - The node to traverse
 * @param matcher - Partial object to match against (uses lodash isMatch)
 * @returns All matching nodes
 * @public
 */
export function findAll<M extends Matcher<namedTypes.ASTNode | AST.Node>>(
  ast: AST.Node | namedTypes.ASTNode,
  matcher: M,
): (AST.Node & { type: M['type'] })[] {
  const matchingNodes: (AST.Node | namedTypes.Node)[] = [];

  if (ast.type.startsWith('V')) {
    AST.traverseNodes(ast as AST.Node, {
      enterNode(node) {
        if (isMatch(node, matcher)) {
          matchingNodes.push(node);
        }
      },
    });
  } else {
    visit(ast, {
      visitNode(path) {
        if (isMatch(path.node, matcher)) {
          matchingNodes.push(path.node);
        }

        this.traverse(path);
      },
    });
  }

  return matchingNodes as never;
}

/**
 * Finds an existing import declaration for a module in a script AST.
 *
 * @example
 * ```ts
 * const vueImport = findImportDeclaration(scriptAST, 'vue');
 * if (vueImport) {
 *   // An `import ... from 'vue'` declaration exists
 * }
 * ```
 *
 * @param ast - The script AST
 * @param moduleSpecifier - The module name (e.g. `'vue'`, `'lodash-es'`)
 * @returns The ImportDeclaration node if one was found, or null
 * @public
 */
export function findImportDeclaration(
  ast: namedTypes.Program,
  moduleSpecifier: string,
): namedTypes.ImportDeclaration | null {
  return findFirst(ast, {
    type: 'ImportDeclaration',
    source: {
      type: 'Literal',
      value: moduleSpecifier,
    },
  });
}

/**
 * Adds a named import to a script AST. If an import declaration for the module
 * already exists, the new specifier is merged into it. Duplicate imports are skipped.
 *
 * @example
 * ```ts
 * // import { defineComponent } from 'vue';
 * createNamedImport(scriptAST, 'vue', 'defineComponent');
 *
 * // import { map as lodashMap } from 'lodash-es';
 * createNamedImport(scriptAST, 'lodash-es', 'map', 'lodashMap');
 * ```
 *
 * @param ast - The script AST
 * @param moduleSpecifier - The module name to import from (e.g. `'vue'`)
 * @param importName - The exported name of the import
 * @param localName - The local alias (defaults to `importName`)
 * @public
 */
export function createNamedImport(
  ast: namedTypes.Program,
  moduleSpecifier: string,
  importName: string,
  localName = importName,
) {
  const decl = findImportDeclaration(ast, moduleSpecifier);
  const newSpecifier = builders.importSpecifier(
    builders.identifier(importName),
    importName !== localName ? builders.identifier(localName) : null,
  );

  if (!decl) {
    // case 1: no existing import for this module
    ast.body.unshift(builders.importDeclaration([newSpecifier], builders.literal(moduleSpecifier)));
  } else if (decl && !decl.specifiers) {
    // case 2: existing import, but with no specifiers
    decl.specifiers = [newSpecifier];
  } else if (decl && decl.specifiers) {
    let found = false;
    for (const specifier of decl.specifiers!) {
      if (specifier.type !== 'ImportSpecifier') {
        continue;
      }

      if (specifier.imported.type !== 'Identifier') {
        continue;
      }

      if (
        specifier.imported.name === importName &&
        (localName === importName || specifier.local?.name === localName)
      ) {
        found = true;
      }
    }

    if (!found) {
      decl.specifiers.push(newSpecifier);
    }
  }
}

/**
 * Adds a default import to a script AST. If an import declaration for the module
 * already exists, the default specifier is merged into it. Duplicate imports are skipped.
 *
 * @example
 * ```ts
 * // import Vue from 'vue';
 * createDefaultImport(scriptAST, 'vue', 'Vue');
 * ```
 *
 * @param ast - The script AST
 * @param moduleSpecifier - The module name to import from (e.g. `'vue'`)
 * @param importName - The local name for the default import
 * @public
 */
export function createDefaultImport(
  ast: namedTypes.Program,
  moduleSpecifier: string,
  importName: string,
) {
  const decl = findImportDeclaration(ast, moduleSpecifier);
  const newSpecifier = builders.importDefaultSpecifier(builders.identifier(importName));

  if (!decl) {
    // case 1: no existing import for this module
    ast.body.unshift(builders.importDeclaration([newSpecifier], builders.literal(moduleSpecifier)));
  } else if (decl && !decl.specifiers) {
    // case 2: existing import, but with no specifiers
    decl.specifiers = [newSpecifier];
  } else if (decl && decl.specifiers) {
    let found = false;
    for (const specifier of decl.specifiers!) {
      if (specifier.type !== 'ImportDefaultSpecifier') {
        continue;
      }

      if (!specifier.local || specifier.local.type !== 'Identifier') {
        continue;
      }

      if (specifier.local.name === importName) {
        found = true;
      }
    }

    if (!found) {
      decl.specifiers.push(newSpecifier);
    }
  }
}

/**
 * Adds a namespace (star) import to a script AST. If an import declaration for
 * the module already exists, the namespace specifier is merged into it. Duplicate imports are skipped.
 *
 * @example
 * ```ts
 * // import * as _ from 'lodash-es';
 * createNamespaceImport(scriptAST, 'lodash-es', '_');
 * ```
 *
 * @param ast - The script AST
 * @param moduleSpecifier - The module name to import from (e.g. `'lodash-es'`)
 * @param namespaceName - The local name for the namespace import
 * @public
 */
export function createNamespaceImport(
  ast: namedTypes.Program,
  moduleSpecifier: string,
  namespaceName: string,
) {
  const decl = findImportDeclaration(ast, moduleSpecifier);
  const newSpecifier = builders.importNamespaceSpecifier(builders.identifier(namespaceName));

  if (!decl) {
    // case 1: no existing import for this module
    ast.body.unshift(builders.importDeclaration([newSpecifier], builders.literal(moduleSpecifier)));
  } else if (decl && !decl.specifiers) {
    // case 2: existing import, but with no specifiers
    decl.specifiers = [newSpecifier];
  } else if (decl && decl.specifiers) {
    let found = false;
    for (const specifier of decl.specifiers!) {
      if (specifier.type !== 'ImportNamespaceSpecifier') {
        continue;
      }

      if (!specifier.name || specifier.name.type !== 'Identifier') {
        continue;
      }

      if (specifier.name.name === namespaceName) {
        found = true;
      }
    }

    if (!found) {
      decl.specifiers.push(newSpecifier);
    }
  }
}

/**
 * Finds all Vue Options API object expressions in a script AST.
 *
 * Detects objects passed to `defineComponent()`, `Vue.extend()`, `Vue.component()`,
 * `Vue.mixin()`, and `new Vue()`. When `isSfc` is true, also treats the default export
 * as an options object.
 *
 * @example
 * ```ts
 * for (const scriptAST of scriptASTs) {
 *   const options = findVueComponentOptions(scriptAST, sfcAST !== null);
 *   for (const obj of options) {
 *     // obj is an ObjectExpression — the { ... } passed to defineComponent(), etc.
 *   }
 * }
 * ```
 *
 * @param ast - The script AST
 * @param isSfc - If true, treat the default export as an options api object
 * @returns Array of ObjectExpression nodes
 * @public
 */
export function findVueComponentOptions(
  ast: namedTypes.Program,
  isSfc: boolean,
): namedTypes.ObjectExpression[] {
  const objects: namedTypes.ObjectExpression[] = [];

  visit(ast, {
    visitExportDefaultDeclaration(path) {
      // sfc: export default { ... }
      if (isSfc && path.node.declaration.type === 'ObjectExpression') {
        objects.push(path.node.declaration);
      }
      this.traverse(path);
    },

    visitCallExpression(path) {
      // defineComponent({ ... })
      if (
        path.node.callee.type === 'Identifier' &&
        path.node.callee.name === 'defineComponent' &&
        path.node.arguments[0]?.type === 'ObjectExpression'
      ) {
        objects.push(path.node.arguments[0]);
      }

      // Vue.extend({ ... })
      // Vue.component({ ... })
      // Vue.mixin({ ... })
      if (
        path.node.callee.type === 'MemberExpression' &&
        path.node.callee.object.type === 'Identifier' &&
        path.node.callee.property.type === 'Identifier' &&
        path.node.callee.object.name === 'Vue' &&
        ['extend', 'component', 'mixin'].includes(path.node.callee.property.name) &&
        path.node.arguments[0]?.type === 'ObjectExpression'
      ) {
        objects.push(path.node.arguments[0]);
      }

      this.traverse(path);
    },

    visitNewExpression(path) {
      if (
        path.node.callee.type === 'Identifier' &&
        path.node.callee.name === 'Vue' &&
        path.node.arguments[0]?.type === 'ObjectExpression'
      ) {
        objects.push(path.node.arguments[0]);
      }

      this.traverse(path);
    },
  });

  return objects;
}
