import { builders, namedTypes, visit } from 'ast-types';
import { isMatch } from 'lodash-es';
import * as AST from './ast';

type Matcher<T> = T extends { type: string }
  ? {
    [key in Exclude<keyof T, 'type' | 'comments' | 'loc' | 'range'>]?: NonNullable<T[key]> extends (infer A)[]
      ? Matcher<A>[]
      : Matcher<T[key]>
  } & { type: T['type'] }
  : T;

/**
 * Finds the first node in an AST that matches a partial node
 * @param ast - The node to traverse
 * @param matcher - Partial object to match against
 * @returns The first matching node, or null if no matching node was found
 */
export function findFirst<
  M extends Matcher<namedTypes.ASTNode | AST.Node>,
>(ast: AST.Node | namedTypes.ASTNode, matcher: M): (AST.Node & { type: M['type'] }) | null {
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

export function findAll<
  M extends Matcher<namedTypes.ASTNode | AST.Node>,
>(ast: AST.Node | namedTypes.ASTNode, matcher: M): (AST.Node & { type: M['type'] })[] {
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
 * Finds an existing import declaration for a module
 * @param ast - The script AST
 * @param moduleSpecifier - The module name
 * @returns The ImportDeclaration node if one was found, or null
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
 * Inserts a named import at the top of a script, or inserts a named import on
 * an existing import declaration for the moduleSpecifier
 * @param ast - The script AST
 * @param moduleSpecifier - The module name to import from
 * @param importName - The name of the import
 * @param localName - (optional) The local name of the named import
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
    ast.body.unshift(
      builders.importDeclaration(
        [newSpecifier],
        builders.literal(moduleSpecifier),
      ),
    );
  } else if (decl && !decl.specifiers) {
    // case 2: existing import, but with no specifiers
    decl.specifiers = [newSpecifier];
  } else if (decl && decl.specifiers) {
    let found = false;
    for (const specifier of decl.specifiers!) {
      if (specifier.type !== 'ImportSpecifier') {
        continue;
      }

      if (!specifier.name || specifier.name.type !== 'Identifier') {
        continue;
      }

      if (specifier.name.name === importName
        && (localName === importName || specifier.local?.name === localName)) {
        found = true;
      }
    }

    if (!found) {
      decl.specifiers.push(newSpecifier);
    }
  }
}

/**
 * Inserts a default import at the top of a script, or inserts a default import
 * on an existing import declaration for the moduleSpecifier
 * @param ast - The script AST
 * @param moduleSpecifier - The module name to import from
 * @param importName - The name of the default import
 */
export function createDefaultImport(
  ast: namedTypes.Program,
  moduleSpecifier: string,
  importName: string,
) {
  const decl = findImportDeclaration(ast, moduleSpecifier);
  const newSpecifier = builders.importDefaultSpecifier(
    builders.identifier(importName),
  );

  if (!decl) {
    // case 1: no existing import for this module
    ast.body.unshift(
      builders.importDeclaration(
        [newSpecifier],
        builders.literal(moduleSpecifier),
      ),
    );
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
 * Inserts a namespaced import at the top of a script
 * @param ast - The script AST
 * @param moduleSpecifier - The module name to import from
 * @param namespaceName - The name of the namespace in the module
 */
export function createNamespaceImport(
  ast: namedTypes.Program,
  moduleSpecifier: string,
  namespaceName: string,
) {
  const decl = findImportDeclaration(ast, moduleSpecifier);
  const newSpecifier = builders.importNamespaceSpecifier(
    builders.identifier(namespaceName),
  );

  if (!decl) {
    // case 1: no existing import for this module
    ast.body.unshift(
      builders.importDeclaration(
        [newSpecifier],
        builders.literal(moduleSpecifier),
      ),
    );
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
 * Finds the Options API objects passed to Vue.extend(), Vue.component(), Vue.mixin(), defineComponent()
 * @param ast - The script AST
 * @param isSfc - If true, treat the default export as an options api object
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
      if (path.node.callee.type === 'Identifier'
        && path.node.callee.name === 'defineComponent'
        && path.node.arguments[0]?.type === 'ObjectExpression') {
        objects.push(path.node.arguments[0]);
      }

      // Vue.extend({ ... })
      // Vue.component({ ... })
      // Vue.mixin({ ... })
      if (path.node.callee.type === 'MemberExpression'
        && path.node.callee.object.type === 'Identifier'
        && path.node.callee.property.type === 'Identifier'
        && path.node.callee.object.name === 'Vue'
        && ['extend', 'component', 'mixin'].includes(path.node.callee.property.name)
        && path.node.arguments[0]?.type === 'ObjectExpression') {
        objects.push(path.node.arguments[0]);
      }

      this.traverse(path);
    },
  });

  return objects;
}
