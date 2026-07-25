import fork from "./fork";
import esProposalsDef from "./def/es-proposals";
import jsxDef from "./def/jsx";
import flowDef from "./def/flow";
import esprimaDef from "./def/esprima";
import babelDef from "./def/babel";
import typescriptDef from "./def/typescript";
// LOCAL ADDITION: describes the @babel/parser 8 AST shape. See ./def/babel8.ts.
import babel8Def from "./def/babel8";
import type { ASTNode, AnyType, Field, Type as TypeType } from "./types";
import type { NodePath as NodePathType } from "./node-path";
import { namedTypes } from "./gen/namedTypes";
import type { builders as buildersType } from "./gen/builders";
import type { Visitor } from "./gen/visitor";

const {
  astNodesAreEquivalent,
  builders,
  builtInTypes,
  defineMethod,
  eachField,
  finalize,
  getBuilderName,
  getFieldNames,
  getFieldValue,
  getSupertypeNames,
  namedTypes: n,
  NodePath,
  Path,
  PathVisitor,
  someField,
  Type,
  use,
  visit,
} = fork([
  // Feel free to add to or remove from this list of extension modules to
  // configure the precise type hierarchy that you need.
  esProposalsDef,
  jsxDef,
  flowDef,
  esprimaDef,
  babelDef,
  typescriptDef,
  // Must come last: it redefines fields on types the defs above declare.
  babel8Def,
]);

// Populate the exported fields of the namedTypes namespace, while still
// retaining its member types.
Object.assign(namedTypes, n);

// LOCAL DEVIATION: upstream imports `Type`, `NodePath` and `builders` as types
// and relies on them merging with the same-named values destructured from
// fork() above. `isolatedModules` (which this repo enables, and which the
// bundler needs) disallows re-exporting an imported type from a value export
// list, so the type meanings are re-declared here as local aliases instead.
// Each name below is still exported with both its value and type meaning.
type Type<T> = TypeType<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodePath<N = any, V = any> = NodePathType<N, V>;
type builders = buildersType;

export {
  astNodesAreEquivalent,
  builders,
  builtInTypes,
  defineMethod,
  eachField,
  finalize,
  getBuilderName,
  getFieldNames,
  getFieldValue,
  getSupertypeNames,
  namedTypes,
  NodePath,
  Path,
  PathVisitor,
  someField,
  Type,
  use,
  visit,
};

export type { AnyType, ASTNode, Field, Visitor };
