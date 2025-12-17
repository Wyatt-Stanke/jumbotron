import type { FilterObject } from "@jumbotron/injector-mod-format";
import { TagSymbol, type Tag } from "@jumbotron/injector-symbols";

export const f = {
	function: (name: string, tag?: Tag) => {
		return {
			type: "FunctionDeclaration",
			id: { name: name, ...(tag ? { [TagSymbol]: tag } : {}) },
		};
	},

	boolean: (value: boolean, tag?: Tag) => {
		return {
			type: "BooleanLiteral",
			value: value,
			...(tag ? { [TagSymbol]: tag } : {}),
		};
	},

	true: (tag?: Tag) => {
		return f.boolean(true, tag);
	},

	false: (tag?: Tag) => {
		return f.boolean(false, tag);
	},

	variableDeclarator: (init: FilterObject, tag?: Tag) => {
		return {
			type: "VariableDeclarator",
			init: init,
			...(tag ? { [TagSymbol]: tag } : {}),
		};
	},
};
