import type { Fork } from "./types";
import typesPlugin from "./types";

export default function (fork: Fork) {
    var types = fork.use(typesPlugin);
    var Type = types.Type;
    var builtin = types.builtInTypes;
    var isNumber = builtin.number;

    // An example of constructing a new type with arbitrary constraints from
    // an existing type.
    function geq(than: any) {
        return Type.from(
            (value: number) => isNumber.check(value) && value >= than,
            isNumber + " >= " + than,
        );
    };

    // Default value-returning functions that may optionally be passed as a
    // third argument to Def.prototype.field.
    const defaults = {
        // Functions were used because (among other reasons) that's the most
        // elegant way to allow for the emptyArray one always to give a new
        // array instance.
        "null": function () { return null },
        "emptyArray": function () { return [] },
        "false": function () { return false },
        "true": function () { return true },
        "undefined": function () { },
        "use strict": function () { return "use strict"; }
    };

    var naiveIsPrimitive = Type.or(
        builtin.string,
        builtin.number,
        builtin.boolean,
        builtin.null,
        builtin.undefined
    );

    const isPrimitive = Type.from(
        (value: any) => {
            if (value === null)
                return true;
            var type = typeof value;
            if (type === "object" ||
                type === "function") {
                return false;
            }
            return true;
        },
        naiveIsPrimitive.toString(),
    );

    return {
        geq,
        defaults,
        isPrimitive,
    };
};

// I would use `typeof module` for this, but that would add
//
//   /// <reference types="node" />
//
// at the top of shared.d.ts, which pulls in @types/node, which we should try to
// avoid unless absolutely necessary, due to the risk of conflict with other
// copies of @types/node.
interface NodeModule {
    exports: {
        default?: any;
        __esModule?: boolean;
    };
}

// This function accepts a getter function that should return an object
// conforming to the NodeModule interface above. Typically, this means calling
// maybeSetModuleExports(() => module) at the very end of any module that has a
// default export, so the default export value can replace module.exports and
// thus CommonJS consumers can continue to rely on require("./that/module")
// returning the default-exported value, rather than always returning an exports
// object with a default property equal to that value. This function should help
// preserve backwards compatibility for CommonJS consumers, as a replacement for
// the ts-add-module-exports package.
// LOCAL DEVIATION: this is a no-op here, where upstream rewrites
// `module.exports`. vue-metamorph is ESM only, so there are no CommonJS
// consumers to preserve compatibility for — and under an ESM loader `module`
// resolves to a namespace object whose `exports` is a getter-only binding, so
// the upstream body throws `Cannot set property default of [object Module]`
// rather than bailing out via the try/catch. The ~28 call sites are left
// untouched so the rest of the vendored sources stay verbatim.
export function maybeSetModuleExports(
    _moduleGetter: () => NodeModule,
) {
}
