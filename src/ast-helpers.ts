import { builders, namedTypes, visit } from './vendor/ast-types/main';
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
 * Finds the first node in an AST that matches a partial node, using deep partial matching.
 * This function works with both script ASTs from ESTree and template ASTs from
 * vue-eslint-parser.
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
 * @param ast - The node to traverse.
 * @param matcher - A partial object to match against. Matching uses the lodash `isMatch`
 * function.
 * @returns The first matching node, or `null` if there's no match.
 * @public
 */
export function findFirst<M extends Matcher<namedTypes.ASTNode | AST.Node>>(
  ast: AST.Node | namedTypes.ASTNode,
  matcher: M,
): (AST.Node & { type: M['type'] }) | null {
  let matchingNode: AST.Node | namedTypes.Node | null = null;

  if (AST.TEMPLATE_NODE_TYPES.has(ast.type)) {
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
 * Finds every node in an AST that matches a partial node, using deep partial matching.
 * This function works with both script ASTs from ESTree and template ASTs from
 * vue-eslint-parser.
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
 * @param ast - The node to traverse.
 * @param matcher - A partial object to match against. Matching uses the lodash `isMatch`
 * function.
 * @returns Every matching node.
 * @public
 */
export function findAll<M extends Matcher<namedTypes.ASTNode | AST.Node>>(
  ast: AST.Node | namedTypes.ASTNode,
  matcher: M,
): (AST.Node & { type: M['type'] })[] {
  const matchingNodes: (AST.Node | namedTypes.Node)[] = [];

  if (AST.TEMPLATE_NODE_TYPES.has(ast.type)) {
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
 * @param ast - The script AST.
 * @param moduleSpecifier - The module name, such as `'vue'` or `'lodash-es'`.
 * @returns The `ImportDeclaration` node, or `null` if there's no match.
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
 * Adds a named import to a script AST. If an import declaration for the module already exists,
 * this function merges the new specifier into that declaration. It doesn't create duplicate
 * imports.
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
 * @param ast - The script AST.
 * @param moduleSpecifier - The module name to import from, such as `'vue'`.
 * @param importName - The exported name of the import.
 * @param localName - The local alias. Defaults to `importName`.
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

      // The effective local binding name of an existing specifier is its alias if the
      // specifier has one, and otherwise the imported name itself. Comparing against this name
      // avoids matching `{ ref as myRef }` when the caller asked for an unaliased `ref`
      // binding.
      const effectiveLocalName = specifier.local?.name ?? specifier.imported.name;
      if (specifier.imported.name === importName && effectiveLocalName === localName) {
        found = true;
      }
    }

    if (!found) {
      decl.specifiers.push(newSpecifier);
    }
  }
}

/**
 * Adds a default import to a script AST. If an import declaration for the module already exists,
 * this function merges the default specifier into that declaration. It doesn't create duplicate
 * imports.
 *
 * @example
 * ```ts
 * // import Vue from 'vue';
 * createDefaultImport(scriptAST, 'vue', 'Vue');
 * ```
 *
 * @param ast - The script AST.
 * @param moduleSpecifier - The module name to import from, such as `'vue'`.
 * @param importName - The local name for the default import.
 * @throws An error if the declaration already has a default import under a different name.
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
    let existingDefaultName: string | null = null;
    for (const specifier of decl.specifiers) {
      if (specifier.type !== 'ImportDefaultSpecifier') {
        continue;
      }

      if (!specifier.local || specifier.local.type !== 'Identifier') {
        continue;
      }

      existingDefaultName = specifier.local.name;
    }

    if (existingDefaultName === null) {
      decl.specifiers.push(newSpecifier);
    } else if (existingDefaultName !== importName) {
      // An ESM ImportDeclaration can have at most one default specifier, and pushing a second
      // one produces invalid JavaScript. Report the conflict so that the codemod author can
      // resolve it explicitly.
      throw new Error(
        `Cannot add default import '${importName}' from '${moduleSpecifier}': a different default import '${existingDefaultName}' already exists.`,
      );
    }
  }
}

/**
 * Adds a namespace import to a script AST. If an import declaration for the module already
 * exists, this function merges the namespace specifier into that declaration. It doesn't create
 * duplicate imports.
 *
 * @example
 * ```ts
 * // import * as _ from 'lodash-es';
 * createNamespaceImport(scriptAST, 'lodash-es', '_');
 * ```
 *
 * @param ast - The script AST.
 * @param moduleSpecifier - The module name to import from, such as `'lodash-es'`.
 * @param namespaceName - The local name for the namespace import.
 * @throws An error if the declaration already has a namespace import under a different name.
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
    return;
  }

  if (!decl.specifiers) {
    // case 2: existing import, but with no specifiers
    decl.specifiers = [newSpecifier];
    return;
  }

  let existingNamespaceName: string | null = null;
  let hasNamedSpecifier = false;
  for (const specifier of decl.specifiers) {
    if (specifier.type === 'ImportNamespaceSpecifier') {
      if (specifier.local?.type === 'Identifier') {
        existingNamespaceName = specifier.local.name;
      }
    } else if (specifier.type === 'ImportSpecifier') {
      hasNamedSpecifier = true;
    }
  }

  if (existingNamespaceName !== null) {
    if (existingNamespaceName === namespaceName) {
      return;
    }
    throw new Error(
      `Cannot add namespace import '${namespaceName}' from '${moduleSpecifier}': a different namespace import '${existingNamespaceName}' already exists.`,
    );
  }

  if (hasNamedSpecifier) {
    // ESM forbids combining a namespace import with named imports in one declaration, so this
    // function adds a sibling declaration instead.
    const idx = ast.body.indexOf(decl);
    ast.body.splice(
      idx === -1 ? 0 : idx,
      0,
      builders.importDeclaration([newSpecifier], builders.literal(moduleSpecifier)),
    );
    return;
  }

  decl.specifiers.push(newSpecifier);
}

/**
 * Finds every Vue Options API object expression in a script AST.
 *
 * This function detects the objects that are passed to `defineComponent()`, `Vue.extend()`,
 * `Vue.component()`, `Vue.mixin()`, and `new Vue()`. When `isSfc` is `true`, it also treats the
 * default export as an options object.
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
 * @param ast - The script AST.
 * @param isSfc - If `true`, treat the default export as an Options API object.
 * @returns An array of `ObjectExpression` nodes.
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
