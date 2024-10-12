import { parseJS, generate, type types } from "@jumbotron/parser";
import traverse, { type NodePath } from "@babel/traverse";

// TODO: consider esast, unist, and unified js system for parsing and transforming the AST

const flattenObject = (obj, delimiter = ".", prefix = "") =>
	Object.keys(obj).reduce((acc, k) => {
		const pre = prefix.length ? `${prefix}${delimiter}` : "";
		if (
			typeof obj[k] === "object" &&
			obj[k] !== null &&
			Object.keys(obj[k]).length > 0
		)
			Object.assign(acc, flattenObject(obj[k], delimiter, pre + k));
		else acc[pre + k] = obj[k];
		return acc;
	}, {});

const isObject = (obj: unknown): obj is Record<string, unknown> =>
	obj.constructor.name === "Object";

const Contains = Symbol("Contains");
const Tag = Symbol("Tag");

const Actions = {
	Delete: Symbol("Actions.Delete"),
	ReplaceProperty: Symbol("Actions.ReplaceProperty"),
};

// TODO: use a better type system that uses the actual AST types
type Key = string | number | boolean;
type FilterArray = [typeof Contains, FilterArray | FilterObject];
interface FilterObject
	extends Record<string, FilterArray | FilterObject | Key> {
	[Tag]?: number;
}

interface BaseAction {
	type: (typeof Actions)[keyof typeof Actions];
}

interface DeleteAction extends BaseAction {
	type: typeof Actions.Delete;
}

interface ReplacePropertyAction extends BaseAction {
	type: typeof Actions.ReplaceProperty;
	property: string;
	value: Key;
}

interface Filter {
	selector: FilterObject;
	actions: Record<number, (DeleteAction | ReplacePropertyAction)[]>;
}

const filters: Filter[] = [
	{
		selector: {
			type: "VariableDeclarator",
			init: {
				type: "ObjectExpression",
				properties: [
					Contains,
					{
						key: { name: "Extensions" },
						value: {
							type: "ArrayExpression",
							elements: [
								Contains,
								{
									type: "ObjectExpression",
									properties: [
										Contains,
										{
											key: { name: "name" },
											value: { value: "Poki" },
										},
									],
									[Tag]: 1,
								},
							],
						},
					},
				],
			},
		},
		actions: {
			1: [{ type: Actions.Delete }],
		},
	},
	{
		selector: {
			type: "VariableDeclarator",
			init: {
				type: "ObjectExpression",
				properties: [
					Contains,
					{
						key: { name: "Extensions" },
						value: {
							type: "ArrayExpression",
							elements: [
								Contains,
								{
									type: "ObjectExpression",
									properties: [
										Contains,
										{
											key: { name: "init" },
											value: { value: "gml_Script_poki_init" },
										},
									],
									[Tag]: 1,
								},
							],
						},
					},
				],
			},
		},
		actions: {
			1: [{ type: Actions.Delete }],
		},
	},
	{
		selector: {
			type: "ExpressionStatement",
			expression: {
				type: "AssignmentExpression",
				operator: "=",
				left: {
					type: "MemberExpression",
					object: {
						type: "Identifier",
						name: "global",
					},
					property: {
						type: "Identifier",
						name: "gmlpoki",
					},
				},
				right: {
					type: "BooleanLiteral",
					value: true,
					[Tag]: 1,
				},
			},
		},
		actions: {
			1: [
				{ type: Actions.ReplaceProperty, property: "value", value: false },
				{ type: Actions.ReplaceProperty, property: "raw", value: "false" },
			],
		},
	}
];

function nodeSummary(node: types.Node) {
	const blocks: string[] = [node.type];

	if (node.type === "VariableDeclarator" && "name" in node.id) {
		blocks.push(node.id.name);
	}

	blocks.push(`${node.start}:${node.end}`);

	return `[${blocks.join(" ")}]`;
}

export function checkLevel(
	tnode: types.Node,
	node,
	filter: FilterObject | FilterArray,
	history = [],
	tags = {},
) {
	if (isObject(filter)) {
		for (const [key, value] of Object.entries(filter)) {
			if (!node || node[key] === undefined) {
				console.log(
					`${nodeSummary(tnode)} does not have ${[...history, key].join(".")}`,
				);
				return { result: false };
			}
			if (isObject(value) || Array.isArray(value)) {
				if (
					!checkLevel(tnode, node[key], value, [...history, key], tags).result
				) {
					return { result: false };
				}
			} else {
				if (node[key] !== value) {
					console.log(
						`${nodeSummary(tnode)} does not have ${[...history, key].join(
							".",
						)} = ${value} (got ${node[key]})`,
					);
					return { result: false };
				}
			}
		}
		if (filter[Tag]) {
			tags[filter[Tag]] = history;
		}
		return { result: true, tags };
	}
	if (Array.isArray(filter) && Array.isArray(node)) {
		const [operator, ...rest] = filter;
		if (operator === Contains) {
			for (const [index, item] of node.entries()) {
				if (checkLevel(tnode, item, rest[0], [...history, index], tags).result)
					return { result: true, tags };
			}
			console.log(
				`${nodeSummary(tnode)} does not contain ${[...history, "[]"].join(
					".",
				)}`,
			);
			return { result: false };
		}
	}
	return { result: true, tags };
}

export async function createHooks({ url, logFn }) {
	logFn(`Fetching ${url}...`);
	const js = await fetch(url).then((res) => res.text());
	logFn(`Parsing fetched content (${js.length} bytes)`);
	const ast = parseJS(js);

	// Modify JSON_game properties
	logFn("[STAGE 2] Filtering");
	for (const filter of filters) {
		try {
			traverse(ast, {
				[filter.selector.type as string](tnodePath: NodePath) {
					const tnode = tnodePath.node;
					const result = checkLevel(tnode, tnode, filter.selector);
					if (result.result) {
						console.log("Found", nodeSummary(tnode));
						console.log(result.tags[1]);

						// Create a function that gets the path of the history from an inputted object while keeping the tnode mutable
						// result.tags[1] = ["init", "properties", 0, "value", "elements", 1];

						const tag = result.tags[1];
						let node = tnode;
						for (const key of tag.slice(0, -1)) {
							node = node[key];
						}

						const actions = filter.actions[1];
						const finalItem = result.tags[1].at(-1);

						for (const action of actions) {
							console.log("Applying action", action);
							if (action.type === Actions.Delete) {
								if (typeof finalItem === "number") {
									// TODO: no ts-ignore
									// @ts-ignore
									node.splice(finalItem, 1);
								} else {
									delete node[finalItem];
								}
							} else if (action.type === Actions.ReplaceProperty) {
								console.log(
									"Replacing",
									node[finalItem],
									action.property,
									"with",
									action.value,
								);
								node[finalItem][action.property] = action.value;
								console.log(tnode);
							}
						}

						throw new Error("Found");
					}
				},
			});
			throw new Error("Not found");
		} catch (e) {
			if (e.message === "Not found") {
				logFn(`Filter for ${filter.selector.type} not found!`);
				throw e;
			}
			if (e.message !== "Found") {
				throw e;
			}
		}
	}
	logFn("[STAGE 2] JSON_game properties modified");

	// Serialize the ast to string
	logFn("Serializing AST");
	const code = `${generate(ast)};window.GameMaker_Init()`;
	logFn("Done");
	return code;
}
