import traverse, { type Node, type NodePath } from "@babel/traverse";
import type {
	ArrowFunctionExpression,
	BlockStatement,
	Expression,
	FunctionDeclaration,
} from "@babel/types";
import {
	AddArrayElementPosition,
	type Filter,
} from "@jumbotron/injector-mod-format";
import {
	Actions,
	SubstitutionPrimitives,
	tag,
} from "@jumbotron/injector-symbols";
import { parseJSExpression } from "@jumbotron/parser";
import type { RBFunctionNames, RBFunctions } from "@jumbotron/typings-core";
import { f } from "./fluent";

interface Context<FName extends RBFunctionNames> {
	original: RBFunctions[FName];
	inputs: { [key: string]: unknown };
}

// biome-ignore lint/suspicious/noExplicitAny: Type utility requires any for generic function parameter extraction
type ArgsFromFunction<T extends (...args: any[]) => any> = T extends (
	...args: infer A
) => unknown
	? A
	: never;

export class Override<FName extends RBFunctionNames> {
	originalFunctionName: FName;
	overrideFunction: (
		ctx: Context<FName>,
		...args: ArgsFromFunction<RBFunctions[FName]>
	) => unknown;

	constructor(
		originalFunctionName: FName,
		overrideFunction: (
			ctx: Context<FName>,
			...args: ArgsFromFunction<RBFunctions[FName]>
		) => unknown,
		public options?: {
			inputs?: { [key: string]: unknown };
		},
	) {
		this.originalFunctionName = originalFunctionName;
		this.overrideFunction = overrideFunction;
	}

	newFunctionName(): string {
		// TODO: Id other than just 1
		return `__jumbotron_orig__${SubstitutionPrimitives.UniqueSafeString}$1__$$${this.originalFunctionName}`;
	}

	serializeOverrideFunction(): FunctionDeclaration {
		// Example override function of a function `getVersion`:
		// (ctx, ...args) => {
		//     return ctx.original(...args) + " - my value";
		// }
		// This needs to be convereted to an AST that would serialize to something like this:
		// function getVersion(...args) {
		//     return __jumbotron_orig$getVersion(...args) + " - my value";
		// }

		const originalFunctionName = this.newFunctionName();
		const functionBody: FunctionDeclaration = parseJSExpression(
			`function ${this.originalFunctionName}(...args) {}`,
		) as unknown as FunctionDeclaration;

		const overrideFunction = parseJSExpression(
			this.overrideFunction.toString(),
		) as unknown as ArrowFunctionExpression;

		let overrideFunctionBody = overrideFunction.body;
		// If overrideFunctionBody is not a block statement, wrap it in one

		if (!overrideFunctionBody.type.endsWith("BlockStatement")) {
			overrideFunctionBody = {
				type: "BlockStatement",
				body: [
					{
						type: "ReturnStatement",
						argument: overrideFunctionBody as unknown as Expression,
					},
				],
			} as BlockStatement;
		}

		// PASS 1: Replace all calls of `ctx.original` with the original function name
		traverse(overrideFunctionBody, {
			CallExpression(path: NodePath<Node>) {
				const callee = path.get("callee");
				if (
					callee.isMemberExpression() &&
					callee.get("object").isIdentifier({ name: "ctx" }) &&
					callee.get("property").isIdentifier({ name: "original" })
				) {
					path.replaceWith(
						parseJSExpression(`${originalFunctionName}(...args)`) as Expression,
					);
				}
			},
			noScope: true,
		});

		// PASS 2: Replace all references to `ctx.inputs.<name>` with the value from `this.options.inputs`
		if (this.options?.inputs) {
			const { options } = this;
			traverse(overrideFunctionBody, {
				MemberExpression(path: NodePath<Node>) {
					if (
						path.get("object").isMemberExpression() &&
						path.get("object").get("object").isIdentifier({ name: "ctx" }) &&
						path
							.get("object")
							.get("property")
							.isIdentifier({ name: "inputs" }) &&
						path.get("property").isIdentifier()
					) {
						const inputName = path.get("property").node.name;
						if (inputName in options.inputs) {
							path.replaceWith(
								parseJSExpression(
									JSON.stringify(options.inputs[inputName]),
								) as Expression,
							);
						} else {
							throw new Error(
								`Input "${inputName}" not found in override options.`,
							);
						}
					}
				},
				noScope: true,
			});
		}

		functionBody.body = overrideFunctionBody as BlockStatement;
		functionBody.id = {
			type: "Identifier",
			name: this.originalFunctionName,
		};
		return functionBody;
	}

	compile(): Filter[] {
		return [
			{
				selector: f.function(this.originalFunctionName, tag(1)),
				actions: {
					1: [
						{
							type: Actions.ReplaceProperty,
							property: "name",
							value: this.newFunctionName(),
						},
					],
				},
			},
			{
				actions: {
					program: [
						{
							type: Actions.AddArrayElement,
							position: AddArrayElementPosition.End,
							element: this.serializeOverrideFunction(),
						},
					],
				},
			},
		];
	}
}
