// LOCAL ADDITION — not part of upstream ast-types-x.
//
// Describes the AST shape produced by @babel/parser 8 with the `estree` and
// `typescript` plugins, which is what src/parse/typescript.ts asks for.
//
// Babel 8 aligned its TypeScript AST with typescript-estree. That renamed a
// number of fields, replaced some node types, and introduced others. Anything
// not described here is invisible to `getFieldNames`, and since that is what
// recast consults when reprinting a modified subtree, an undeclared field is
// silently dropped rather than reported — e.g. `Map<string, number>` reprinting
// as `Map`. So the goal is coverage: every field Babel 8 emits must be declared.
//
// This module is deliberately *additive*: it declares the Babel 8 fields and
// node types, but it does not repoint any existing `build()` parameter from a
// Babel 7 field name to its Babel 8 replacement. So `b.tsTypeReference(id, args)`
// still produces `typeParameters` while the parser produces `typeArguments`,
// and both print correctly — the vendored printer reads whichever name a node
// carries (see printFirstOf in ../../recast/lib/printer.ts).
//
// Keeping the builders on the old names avoids a breaking change for codemods
// that construct nodes by hand. It is not merely cosmetic: an earlier revision
// did flip them, and `scripts/gen-ast-types.ts` — which builds nodes with these
// builders and prints them through recast — silently regenerated `builders.ts`
// with every type annotation stripped off.
import { Fork } from "../types";
import typescriptDef from "./typescript";
import typesPlugin from "../types";
import sharedPlugin, { maybeSetModuleExports } from "../shared";

export default function (fork: Fork) {
  fork.use(typescriptDef);

  var types = fork.use(typesPlugin);
  var n = types.namedTypes;
  var def = types.Type.def;
  var or = types.Type.or;
  var defaults = fork.use(sharedPlugin).defaults;

  var StringLiteral = types.Type.from(function (value: any, deep?: any) {
    if (n.StringLiteral && n.StringLiteral.check(value, deep)) {
      return true;
    }
    if (n.Literal && n.Literal.check(value, deep) && typeof value.value === "string") {
      return true;
    }
    return false;
  }, "StringLiteral");

  var TSEntityName = or(def("Identifier"), def("TSQualifiedName"));

  var Accessibility = or("public", "private", "protected", void 0);

  var ParametersType = [or(
    def("Identifier"),
    def("RestElement"),
    def("ArrayPattern"),
    def("ObjectPattern"),
    def("TSParameterProperty"),
  )];

  var OptionalTypeArguments = or(def("TSTypeParameterInstantiation"), null, void 0);

  var OptionalReturnType = or(def("TSTypeAnnotation"), def("Noop"), null, void 0);

  // Babel 8 renamed `parameters` to `params` on the function-shaped type nodes.
  // The field is declared so traversal and reprinting can see it, but it
  // defaults to `undefined` rather than `[]`, because recast's
  // printFunctionParams checks `if (fun.params)` before falling back to
  // `fun.parameters` — materializing an empty array on every built node would
  // make every builder emit an empty parameter list.
  var OptionalParams = or(ParametersType, void 0);

  // ==========================================================================
  // New node types
  // ==========================================================================

  // `enum E { A }` — members moved behind a TSEnumBody node.
  def("TSEnumBody")
    .bases("Node")
    .build("members")
    .field("members", [def("TSEnumMember")]);

  // Replaces TSExpressionWithTypeArguments in `interface I extends J<K>`.
  def("TSInterfaceHeritage")
    .bases("Node")
    .build("expression", "typeArguments")
    .field("expression", TSEntityName)
    .field("typeArguments", OptionalTypeArguments, defaults["undefined"]);

  // `class A implements D, E<F>` — the TypeScript counterpart to Flow's
  // ClassImplements, which is what Babel 7 reused for this.
  def("TSClassImplements")
    .bases("Node")
    .build("expression", "typeArguments")
    .field("expression", TSEntityName)
    .field("typeArguments", OptionalTypeArguments, defaults["undefined"]);

  // Template literal *types* used to reuse TemplateLiteral; they now have their
  // own node, whose interpolations are types rather than expressions.
  def("TSTemplateLiteralType")
    .bases("TSType")
    .build("quasis", "types")
    .field("quasis", [def("TemplateElement")])
    .field("types", [def("TSType")]);

  // The `value` of an abstract or declared method: a function with no body.
  def("TSEmptyBodyFunctionExpression")
    .bases("FunctionExpression")
    .build("id", "params", "returnType")
    .field("id", or(def("Identifier"), null), defaults["null"])
    .field("params", [def("Pattern")])
    .field("body", null, defaults["null"])
    .field("declare", Boolean, defaults["false"])
    .field("expression", Boolean, defaults["false"])
    .field("returnType", OptionalReturnType, defaults["null"]);

  // `abstract m(): void` / `abstract p: string` inside a class body. Based on
  // their concrete counterparts so ClassBody's element check still accepts them.
  def("TSAbstractMethodDefinition")
    .bases("MethodDefinition")
    .build("key", "value", "kind", "static")
    .field("value", or(def("TSEmptyBodyFunctionExpression"), def("FunctionExpression")))
    .field("accessibility", Accessibility, defaults["undefined"])
    .field("decorators", or([def("Decorator")], null), defaults["null"])
    .field("optional", Boolean, defaults["false"])
    .field("override", Boolean, defaults["false"]);

  def("TSAbstractPropertyDefinition")
    .bases("PropertyDefinition")
    .build("key", "value")
    .field("value", or(def("Expression"), null), defaults["null"])
    .field("accessibility", Accessibility, defaults["undefined"])
    .field("declare", Boolean, defaults["false"])
    .field("definite", Boolean, defaults["false"])
    .field("optional", Boolean, defaults["false"])
    .field("override", Boolean, defaults["false"])
    .field("readonly", Boolean, defaults["false"]);

  // ==========================================================================
  // TypeScript field renames
  // ==========================================================================

  // typeParameters -> typeArguments, at every use site that holds *arguments*
  // rather than *declarations*.
  def("TSTypeReference")
    .field("typeArguments", OptionalTypeArguments, defaults["undefined"]);

  def("TSInstantiationExpression")
    .field("typeArguments", OptionalTypeArguments, defaults["undefined"]);

  def("JSXOpeningElement")
    .field("typeArguments", OptionalTypeArguments, defaults["undefined"]);

  [
    "ClassDeclaration",
    "ClassExpression",
  ].forEach(typeName => {
    def(typeName)
      .field("abstract", Boolean, defaults["false"])
      .field("declare", Boolean, defaults["false"])
      .field("superTypeArguments", OptionalTypeArguments, defaults["undefined"])
      // Widened from type-annotations.ts to admit TSClassImplements.
      .field("implements",
        or([def("TSClassImplements")],
          [def("ClassImplements")],
          [def("TSExpressionWithTypeArguments")]),
        defaults.emptyArray);
  });

  // parameters -> params, typeAnnotation -> returnType, on everything
  // function-shaped in a type position.
  [
    "TSFunctionType",
    "TSConstructorType",
    "TSCallSignatureDeclaration",
    "TSConstructSignatureDeclaration",
  ].forEach(typeName => {
    def(typeName)
      .field("params", OptionalParams, defaults["undefined"])
      .field("returnType", OptionalReturnType, defaults["undefined"]);
  });

  def("TSConstructorType")
    .field("abstract", Boolean, defaults["false"]);

  def("TSMethodSignature")
    .field("params", OptionalParams, defaults["undefined"])
    .field("returnType", OptionalReturnType, defaults["undefined"])
    .field("kind", or("method", "get", "set"), function getDefault() { return "method"; })
    .field("accessibility", Accessibility, defaults["undefined"])
    .field("readonly", Boolean, defaults["false"])
    .field("static", Boolean, defaults["false"]);

  def("TSIndexSignature")
    .field("accessibility", Accessibility, defaults["undefined"])
    .field("static", Boolean, defaults["false"]);

  def("TSPropertySignature")
    .field("accessibility", Accessibility, defaults["undefined"])
    .field("static", Boolean, defaults["false"]);

  def("TSParameterProperty")
    .field("decorators", or([def("Decorator")], null), defaults["null"])
    .field("override", Boolean, defaults["false"])
    .field("static", Boolean, defaults["false"]);

  def("TSDeclareFunction")
    .field("expression", Boolean, defaults["false"]);

  // members -> body: TSEnumBody
  def("TSEnumDeclaration")
    .field("body", or(def("TSEnumBody"), void 0), defaults["undefined"]);

  def("TSEnumMember")
    .field("computed", Boolean, defaults["false"]);

  // argument -> source, plus import attributes and type arguments.
  def("TSImportType")
    .field("source", or(StringLiteral, void 0), defaults["undefined"])
    .field("options", or(def("Expression"), null, void 0), defaults["undefined"])
    .field("typeArguments", OptionalTypeArguments, defaults["undefined"]);

  // typeParameter -> key + constraint, and nameType may now be a
  // TSTemplateLiteralType (`as \`get${K}\``).
  def("TSMappedType")
    .field("key", or(def("Identifier"), void 0), defaults["undefined"])
    .field("constraint", or(def("TSType"), void 0), defaults["undefined"])
    .field("nameType", or(def("TSType"), null), defaults["null"]);

  def("TSTypeParameter")
    .field("const", Boolean, defaults["false"])
    .field("in", Boolean, defaults["false"])
    .field("out", Boolean, defaults["false"]);

  def("TSModuleDeclaration")
    .field("kind", or("global", "module", "namespace", void 0), defaults["undefined"]);

  def("TSImportEqualsDeclaration")
    .field("importKind", or("type", "value", void 0), defaults["undefined"]);

  def("TSInterfaceDeclaration")
    .field("extends",
      or([or(def("TSInterfaceHeritage"), def("TSExpressionWithTypeArguments"))], null),
      defaults["null"]);

  // ==========================================================================
  // Fields the estree plugin adds to standard ES nodes
  // ==========================================================================

  // Babel 8 emits `{ type: "PrivateIdentifier", name: "x" }`; upstream
  // ast-types models the Babel 7 `{ id: Identifier }` shape. Without `name`
  // declared, `#field` reprints as `#`.
  def("PrivateIdentifier")
    .field("name", or(String, void 0), defaults["undefined"]);

  def("PropertyDefinition")
    .field("accessibility", Accessibility, defaults["undefined"])
    .field("declare", Boolean, defaults["false"])
    .field("definite", Boolean, defaults["false"])
    .field("optional", Boolean, defaults["false"])
    .field("override", Boolean, defaults["false"])
    .field("readonly", Boolean, defaults["false"]);

  def("MethodDefinition")
    .field("accessibility", Accessibility, defaults["undefined"])
    .field("optional", Boolean, defaults["false"])
    .field("override", Boolean, defaults["false"]);

  def("Program")
    .field("sourceType", or("script", "module"), function getDefault() { return "module"; });

  def("Identifier")
    .field("decorators", or([def("Decorator")], null), defaults["null"]);

  def("ExpressionStatement")
    .field("directive", or(String, void 0), defaults["undefined"]);

  def("Literal")
    // `null` is included to stay compatible with the narrower `raw` that
    // babel-core.ts already declares on NumericLiteral; without it the
    // generated NumericLiteral no longer satisfies `Omit<Literal, "type">`.
    .field("raw", or(String, null, void 0), defaults["undefined"])
    .field("bigint", or(String, void 0), defaults["undefined"])
    .field("regex",
      or({ pattern: String, flags: String }, void 0),
      defaults["undefined"]);

  def("VariableDeclaration")
    .field("declare", Boolean, defaults["false"]);

  def("VariableDeclarator")
    .field("definite", Boolean, defaults["false"]);

  def("FunctionDeclaration")
    .field("declare", Boolean, defaults["false"]);

  def("FunctionExpression")
    .field("declare", Boolean, defaults["false"]);

  def("Property")
    .field("optional", Boolean, defaults["false"]);

  // Patterns pick up TS annotations and decorators under the estree plugin.
  def("ArrayPattern")
    .field("decorators", or([def("Decorator")], null), defaults["null"])
    .field("optional", Boolean, defaults["false"])
    .field("typeAnnotation", or(def("TSTypeAnnotation"), null), defaults["null"]);

  def("AssignmentPattern")
    .field("decorators", or([def("Decorator")], null), defaults["null"])
    .field("optional", Boolean, defaults["false"])
    .field("typeAnnotation", or(def("TSTypeAnnotation"), null), defaults["null"]);

  def("ObjectPattern")
    .field("optional", Boolean, defaults["false"]);

  def("RestElement")
    .field("decorators", or([def("Decorator")], null), defaults["null"])
    .field("optional", Boolean, defaults["false"])
    .field("value", or(def("Expression"), null), defaults["null"]);

  // Import/export attributes (`with { type: "json" }`) and type-only markers.
  def("ImportDeclaration")
    .field("attributes", or([def("ImportAttribute")], null), defaults["emptyArray"]);

  def("ImportSpecifier")
    .field("importKind", or("type", "typeof", "value", null, void 0), defaults["undefined"]);

  def("ImportExpression")
    .field("options", or(def("Expression"), null), defaults["null"]);

  def("ExportNamedDeclaration")
    .field("attributes", or([def("ImportAttribute")], null), defaults["emptyArray"])
    .field("exportKind", or("type", "value", void 0), defaults["undefined"]);

  def("ExportAllDeclaration")
    .field("attributes", or([def("ImportAttribute")], null), defaults["emptyArray"])
    .field("exportKind", or("type", "value", void 0), defaults["undefined"]);

  def("ExportDefaultDeclaration")
    .field("exportKind", or("type", "value", void 0), defaults["undefined"]);

  def("ExportSpecifier")
    .field("exportKind", or("type", "value", void 0), defaults["undefined"]);
};

maybeSetModuleExports(() => module);
