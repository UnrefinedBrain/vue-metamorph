import type { namedTypes } from "./main";
import type { NodePath } from "./node-path";
import { maybeSetModuleExports } from "./shared";
import type { Fork } from "./types";
import typesPlugin from "./types";

var hasOwn = Object.prototype.hasOwnProperty;

export type ScopeType = "global" | "function" | "block" | "switch" | "catch" | "with" | "for" | "class" | "type";

export type ScopeBinding = Record<string, NodePath<namedTypes.Identifier>[]>;

export type ScopeTypes = Record<string, NodePath[]>;

export interface Scope {
  type: ScopeType;
  path: NodePath;
  node: NodePath['value'];
  isGlobal: boolean;
  depth: number;
  parent: Scope | null;
  bindings: ScopeBinding;
  types: ScopeTypes;
  didScan: boolean;
  declares(name: string): boolean
  declaresType(name: string): boolean
  markAsStale(): void;
  scan(force?: boolean): void;
  getBindings(): ScopeBinding;
  getTypes(): ScopeTypes;
  lookup(name: string): Scope;
  lookupType(name: string): Scope;
  getGlobalScope(): Scope | null;

  // private methods
  scanScope: (path: NodePath, bindings: ScopeBinding, scopeTypes: ScopeTypes) => void;
  recursiveScanScope: (path: NodePath, bindings: ScopeBinding, scopeTypes: ScopeTypes) => void;
  recursiveScanChild: (path: NodePath, bindings: ScopeBinding, scopeTypes: ScopeTypes) => void;
}

export interface ScopeConstructor {
  new(path: NodePath, parentScope?: Scope | null): Scope;
  isEstablishedBy(node: NodePath['node']): boolean;
}

export default function scopePlugin(fork: Fork) {
  var types = fork.use(typesPlugin);
  var Type = types.Type;
  var namedTypes = types.namedTypes;
  var Node = namedTypes.Node;
  var Expression = namedTypes.Expression;
  var isArray = types.builtInTypes.array;

  const Scope = function Scope(this: Scope, path: NodePath, parentScope?: Scope | null) {
    if (!(this instanceof Scope)) {
      throw new Error("Scope constructor cannot be invoked without 'new'");
    }
    if (!TypeParameterScopeType.check(path.value) && !ScopeType.check(path.value) && !isForScopeType(path.value)) {
      throw new Error("Invalid scope node type " + (path.value as any).type);
    }

    var depth: number;

    if (parentScope) {
      if (!(parentScope instanceof Scope)) {
        throw new Error("");
      }
      depth = (parentScope as Scope).depth + 1;
    } else {
      parentScope = null;
      depth = 0;
    }

    var type = getScopeType(path);

    Object.defineProperties(this, {
      type: { value: type },
      path: { value: path },
      node: { value: path.value },
      isGlobal: { value: !parentScope, enumerable: true },
      depth: { value: depth },
      parent: { value: parentScope },
      bindings: { value: {} },
      types: { value: {} },
    });
  } as any as ScopeConstructor;

  var ScopeType = Type.or(
    // Program nodes introduce global scopes.
    namedTypes.Program,

    // Function is the supertype of FunctionExpression,
    // FunctionDeclaration, ArrowExpression, etc.
    namedTypes.Function,

    // In case you didn't know, the caught parameter shadows any variable
    // of the same name in an outer scope.
    namedTypes.CatchClause,

    namedTypes.BlockStatement,
  );

  var ForLoopType = Type.or(
    namedTypes.ForStatement,
    namedTypes.ForInStatement,
    namedTypes.ForOfStatement
  );

  var isForScopeType = function isScopeType(node: NodePath['node']) {
    if (ForLoopType.check(node)) {
      const variableDeclarator = node.init || node.left;
      return variableDeclarator
        && namedTypes.VariableDeclaration.check(variableDeclarator)
        && variableDeclarator.kind !== "var";
    }

    return false;
  }

  // These types introduce scopes that are restricted to type parameters in
  // Flow (this doesn't apply to ECMAScript).
  var TypeParameterScopeType = Type.or(
    namedTypes.Function,
    namedTypes.ClassDeclaration,
    namedTypes.ClassExpression,
    namedTypes.InterfaceDeclaration,
    namedTypes.TSInterfaceDeclaration,
    namedTypes.TypeAlias,
    namedTypes.TSTypeAliasDeclaration,
  );

  var FlowOrTSTypeParameterType = Type.or(
    namedTypes.TypeParameter,
    namedTypes.TSTypeParameter,
  );

  Scope.isEstablishedBy = function (path: NodePath) {
    const node = path.value;
    if (namedTypes.BlockStatement.check(node) && namedTypes.Function.check(path.parentPath.value)) {
      return false;
    }

    return ScopeType.check(node) || TypeParameterScopeType.check(node) || isForScopeType(node);
  };

  var Sp: Scope = Scope.prototype;

  // Will be overridden after an instance lazily calls scanScope.
  Sp.didScan = false;

  Sp.declares = function (name) {
    this.scan();
    return hasOwn.call(this.bindings, name);
  };

  Sp.declaresType = function (name) {
    this.scan();
    return hasOwn.call(this.types, name);
  };

  Sp.markAsStale = function () {
    this.didScan = false;
  }

  Sp.scan = function (force) {
    if (force || !this.didScan) {
      for (var name in this.bindings) {
        // Empty out this.bindings, just in cases.
        delete this.bindings[name];
      }
      for (var name in this.types) {
        // Empty out this.types, just in cases.
        delete this.types[name];
      }
      this.scanScope(this.path, this.bindings, this.types);
      this.didScan = true;
    }
  };

  Sp.getBindings = function () {
    this.scan();
    return this.bindings;
  };

  Sp.getTypes = function () {
    this.scan();
    return this.types;
  };

  function getScopeType(path: NodePath): ScopeType {
    const node = path.value;
    if (namedTypes.Program.check(node)) {
      return "global";
    }

    if (namedTypes.Function.check(node)) {
      return "function";
    }

    if (namedTypes.BlockStatement.check(node)) {
      return "block";
    }

    if (namedTypes.SwitchStatement.check(node)) {
      return "switch";
    }

    if (namedTypes.CatchClause.check(node)) {
      return "catch";
    }

    if (namedTypes.WithStatement.check(node)) {
      return "with";
    }

    if (ForLoopType.check(node)) {
      return "for";
    }

    if (namedTypes.ClassDeclaration.check(node) || namedTypes.ClassExpression.check(node)) {
      return "class";
    }

    if (TypeParameterScopeType.check(node)) {
      return "type";
    }

    // @ts-ignore
    throw new Error("Cannot determine ScopeType for node " + node.type);
  }

  function getVariableScope(scope: Scope) {
    if (!scope.parent) return scope;

    const variableScopeTypes = ['global', 'module', 'function', 'class-field-initializer', 'class-static-block'];
    if (variableScopeTypes.includes(scope.type)) {
      return scope;
    }

    return getVariableScope(scope.parent);
  }

  Sp.scanScope = function (path: NodePath, bindings: ScopeBinding, scopeTypes: ScopeTypes) {

    var node = path.value;
    if (TypeParameterScopeType.check(node)) {
      const params = path.get('typeParameters', 'params');
      if (isArray.check(params.value)) {
        params.each((childPath: NodePath) => {
          addTypeParameter(childPath, scopeTypes);
        });
      }
    }
    if (ScopeType.check(node)) {
      if (namedTypes.CatchClause.check(node)) {
        // A catch clause establishes a new scope but the only variable
        // bound in that scope is the catch parameter.
        addPattern(path.get("param"), bindings);
      } else {
        this.recursiveScanScope(path, bindings, scopeTypes);
      }
    }

    if (isForScopeType(node)) {
      this.recursiveScanScope(path, bindings, scopeTypes);
    }
  }

  Sp.recursiveScanScope = function (path: NodePath, bindings: ScopeBinding, scopeTypes: ScopeTypes) {
    var node = path.value;

    if (!node) {
      // None of the remaining cases matter if node is falsy.

    } else if (isArray.check(node)) {
      path.each((childPath: NodePath) => {
        this.recursiveScanChild(childPath, bindings, scopeTypes);
      });

    } else if (namedTypes.Function.check(node)) {
      if (namedTypes.FunctionExpression.check(node) && node.id) {
        addPattern(path.get("id"), bindings);
      }

      path.get("params").each((paramPath: NodePath) => {
        addPattern(paramPath, bindings);
      });

      const functionBody = path.get("body");
      if (namedTypes.BlockStatement.check(functionBody.value)) {
        functionBody.get("body").each((childPath: NodePath) => {
          this.recursiveScanChild(childPath, bindings, scopeTypes);
        });
      } else {
        this.recursiveScanChild(functionBody, bindings, scopeTypes);
      }

      this.recursiveScanScope(path.get("typeParameters"), bindings, scopeTypes);

    } else if (
      (namedTypes.TypeAlias && namedTypes.TypeAlias.check(node)) ||
      (namedTypes.InterfaceDeclaration && namedTypes.InterfaceDeclaration.check(node)) ||
      (namedTypes.TSTypeAliasDeclaration && namedTypes.TSTypeAliasDeclaration.check(node)) ||
      (namedTypes.TSInterfaceDeclaration && namedTypes.TSInterfaceDeclaration.check(node))
    ) {
      addTypePattern(path.get("id"), scopeTypes);

    } else if (namedTypes.VariableDeclarator.check(node)) {
      if (path.parent && namedTypes.VariableDeclaration.check(path.parent.node)) {
        var variableTargetScope = path.parent.node.kind === "var" ? getVariableScope(this) : this;
        var bd = variableTargetScope === this ? bindings : variableTargetScope.getBindings();
        addPattern(path.get("id"), bd);
        this.recursiveScanChild(path.get("init"), bd, scopeTypes);
      } else {
        addPattern(path.get("id"), bindings);
        this.recursiveScanChild(path.get("init"), bindings, scopeTypes);
      }

    } else if (node.type === "ImportSpecifier" ||
      node.type === "ImportNamespaceSpecifier" ||
      node.type === "ImportDefaultSpecifier") {
      addPattern(
        // Esprima used to use the .name field to refer to the local
        // binding identifier for ImportSpecifier nodes, but .id for
        // ImportNamespaceSpecifier and ImportDefaultSpecifier nodes.
        // ESTree/Acorn/ESpree use .local for all three node types.
        path.get(node.local ? "local" :
          node.name ? "name" : "id"),
        bindings
      );

    } else if (namedTypes.BlockStatement.check(node.value)) {
      path.get("body").each((childPath: NodePath) => {
        this.recursiveScanChild(childPath, bindings, scopeTypes);
      });

    } else if (Node.check(node) && !Expression.check(node)) {
      types.eachField(node, (name: any, child: any) => {
        var childPath = path.get(name);
        if (!pathHasValue(childPath, child)) {
          throw new Error("");
        }
        this.recursiveScanChild(childPath, bindings, scopeTypes);
      });
    }
  }

  function pathHasValue(path: NodePath, value: any) {
    if (path.value === value) {
      return true;
    }

    // Empty arrays are probably produced by defaults.emptyArray, in which
    // case is makes sense to regard them as equivalent, if not ===.
    if (Array.isArray(path.value) &&
      path.value.length === 0 &&
      Array.isArray(value) &&
      value.length === 0) {
      return true;
    }

    return false;
  }

  Sp.recursiveScanChild = function (path: NodePath, bindings: ScopeBinding, scopeTypes: ScopeTypes) {
    var node = path.value;

    if (!node || Expression.check(node)) {
      // Ignore falsy values and Expressions.

    } else if (namedTypes.FunctionDeclaration.check(node) && node.id !== null) {
      addPattern(path.get("id"), bindings);

    } else if (namedTypes.ClassDeclaration &&
      namedTypes.ClassDeclaration.check(node) &&
      node.id !== null) {
      addPattern(path.get("id"), bindings);
      this.recursiveScanScope(path.get("typeParameters"), bindings, scopeTypes);

    } else if (
      (namedTypes.InterfaceDeclaration &&
        namedTypes.InterfaceDeclaration.check(node)) ||
      (namedTypes.TSInterfaceDeclaration &&
        namedTypes.TSInterfaceDeclaration.check(node))
    ) {
      addTypePattern(path.get("id"), scopeTypes);


    } else if (namedTypes.CatchClause.check(node)) {
      this.recursiveScanScope(path.get("body"), bindings, scopeTypes);

    } else if (ScopeType.check(node) || isForScopeType(node)) {
      // Skip scanning, it belongs another scope.
    } else {
      this.recursiveScanScope(path, bindings, scopeTypes);
    }
  }

  function addPattern(patternPath: NodePath, bindings: ScopeBinding) {
    var pattern = patternPath.value;
    namedTypes.Pattern.assert(pattern);

    if (namedTypes.Identifier.check(pattern)) {
      if (hasOwn.call(bindings, pattern.name)) {
        bindings[pattern.name].push(patternPath);
      } else {
        bindings[pattern.name] = [patternPath];
      }

    } else if (namedTypes.AssignmentPattern &&
      namedTypes.AssignmentPattern.check(pattern)) {
      addPattern(patternPath.get('left'), bindings);

    } else if (
      namedTypes.ObjectPattern &&
      namedTypes.ObjectPattern.check(pattern)
    ) {
      patternPath.get('properties').each((propertyPath: NodePath) => {
        var property = propertyPath.value;
        if (namedTypes.Pattern.check(property)) {
          addPattern(propertyPath, bindings);
        } else if (
          namedTypes.Property.check(property) ||
          (namedTypes.ObjectProperty &&
            namedTypes.ObjectProperty.check(property))
        ) {
          addPattern(propertyPath.get('value'), bindings);
        } else if (
          namedTypes.SpreadProperty &&
          namedTypes.SpreadProperty.check(property)
        ) {
          addPattern(propertyPath.get('argument'), bindings);
        }
      });

    } else if (
      namedTypes.ArrayPattern &&
      namedTypes.ArrayPattern.check(pattern)
    ) {
      patternPath.get('elements').each((elementPath: NodePath) => {
        var element = elementPath.value;
        if (namedTypes.Pattern.check(element)) {
          addPattern(elementPath, bindings);
        } else if (
          namedTypes.SpreadElement &&
          namedTypes.SpreadElement.check(element)
        ) {
          addPattern(elementPath.get("argument"), bindings);
        }
      });

    } else if (
      namedTypes.PropertyPattern &&
      namedTypes.PropertyPattern.check(pattern)
    ) {
      addPattern(patternPath.get('pattern'), bindings);

    } else if (
      (namedTypes.SpreadElementPattern &&
        namedTypes.SpreadElementPattern.check(pattern)) ||
      (namedTypes.RestElement &&
        namedTypes.RestElement.check(pattern)) ||
      (namedTypes.SpreadPropertyPattern &&
        namedTypes.SpreadPropertyPattern.check(pattern))
    ) {
      addPattern(patternPath.get('argument'), bindings);
    }
  }

  function addTypePattern(patternPath: NodePath, scopeTypes: ScopeTypes) {
    var pattern = patternPath.value;
    namedTypes.Pattern.assert(pattern);

    if (namedTypes.Identifier.check(pattern)) {
      if (hasOwn.call(scopeTypes, pattern.name)) {
        scopeTypes[pattern.name].push(patternPath);
      } else {
        scopeTypes[pattern.name] = [patternPath];
      }
    }
  }

  function addTypeParameter(parameterPath: NodePath, scopeTypes: ScopeTypes) {
    var parameter = parameterPath.value;
    FlowOrTSTypeParameterType.assert(parameter);

    if (hasOwn.call(scopeTypes, parameter.name)) {
      scopeTypes[parameter.name].push(parameterPath);
    } else {
      scopeTypes[parameter.name] = [parameterPath];
    }
  }

  Sp.lookup = function (name) {
    for (var scope: Scope | null = this; scope; scope = scope.parent)
      if (scope.declares(name))
        break;
    return scope!;
  };

  Sp.lookupType = function (name) {
    for (var scope: Scope | null = this; scope; scope = scope.parent)
      if (scope.declaresType(name))
        break;
    return scope!;
  };

  Sp.getGlobalScope = function () {
    var scope: Scope | null = this;
    while (scope && !scope.isGlobal)
      scope = scope.parent;
    return scope;
  };

  return Scope;
};

maybeSetModuleExports(() => module);
