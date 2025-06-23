import { parseJS, generate, type types } from "@jumbotron/parser";
import traverse, { type Node, type NodePath } from "@babel/traverse";
import { parseJSExpression } from "../../parser/src";
import { version } from "../../package.json";

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
	AddArrayElement: Symbol("Actions.AddArrayElement"),
	ReplaceSelf: Symbol("Actions.ReplaceSelf"),
};

// TODO: use a better type system that uses the actual AST types
type Key = string | number | boolean;
type FilterArray =
	| [typeof Contains, FilterArray | FilterObject]
	| [typeof Contains, FilterArray | FilterObject, { [Tag]: number }];
export interface FilterObject
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

interface ReplaceSelfAction extends BaseAction {
	type: typeof Actions.ReplaceSelf;
	value: any;
}

interface AddArrayElementAction extends BaseAction {
	type: typeof Actions.AddArrayElement;
	element: any;
}

export type Action =
	| DeleteAction
	| ReplacePropertyAction
	| AddArrayElementAction
	| ReplaceSelfAction;

export interface Filter {
	selector?: FilterObject;
	actions: Record<number, Action[]> & {
		program?: Action[];
	};
}

export interface Mod {
	name: string;
	id: string;
	filters: Filter[];
}

interface LoadingStateMessageStarted {
	type: "started";
	mods: {
		name: string;
		id: string;
		filters: string[];
	}[];
}

interface LoadingStateMessageFilterApplied {
	type: "filterApplied";
	modId: string;
	filterIndex: number;
}

interface LoadingStateMessageFilterFailed {
	type: "filterFailed";
	modId: string;
	filterIndex: number;
}

interface LoadngStateMessageModStarted {
	type: "modStarting";
	modId: string;
	modName: string;
}

interface LoadingStateMessageModFinished {
	type: "modFinished";
	modId: string;
	modName: string;
}

export type LoadingState =
	| LoadingStateMessageStarted
	| LoadingStateMessageFilterApplied
	| LoadingStateMessageFilterFailed
	| LoadngStateMessageModStarted
	| LoadingStateMessageModFinished;

const mods: Mod[] = [
	{
		name: "Jettison Poki",
		id: "jettison-poki",
		filters: [
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
													key: { value: "name" },
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
		],
	},
	{
		name: "Override Poki",
		id: "override-poki",
		filters: [
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
			},
		],
	},
	{
		name: "Show Jumbotron Version",
		id: "show-jumbotron-version",
		filters: [
			{
				selector: {
					type: "FunctionDeclaration",
					id: { name: "gml_Script_s_get_gm_version", [Tag]: 1 },
				},
				actions: {
					1: [
						{
							type: Actions.ReplaceProperty,
							property: "name",
							value: "__jumbotron_orig$gml_Script_s_get_gm_version",
						},
					],
				},
			},
			{
				actions: {
					program: [
						{
							type: Actions.AddArrayElement,
							element: parseJSExpression(`function gml_Script_s_get_gm_version() {
							return __jumbotron_orig$gml_Script_s_get_gm_version() + "\\nJumbotron ${version}";
						}`),
						},
					],
				},
			},
		],
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

const noisy = false;

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
				noisy &&
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
					noisy &&
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
			noisy &&
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

const getPartOfPath = (path: NodePath, part: string | number): NodePath =>
	typeof part === "number" ? path[part] : path.get(part);

function followTagPath(basePath: NodePath, tagPath: (string | number)[]): NodePath {
	let currentPath = basePath;
	for (const key of tagPath) {
		currentPath = typeof key === "number" ? currentPath[key] : currentPath.get(key);
	}
	return currentPath;
}

export function serializeNodePath(tNodePath: NodePath, nodePath: NodePath) {
	return JSON.stringify([serializePath(tNodePath), serializePath(nodePath)]);

	function serializePath(tPath) {
		let path: NodePath = tPath;
		const parts = [];
		do {
			parts.unshift(path.key);
			if (path.inList) parts.unshift(path.listKey);
			path = path.parentPath;
		} while (path);
		return parts;
	}
}

export async function createHooks({
	url,
	logFn,
	loadingStateCallback,
}: {
	url: string;
	logFn: (message: string) => void;
	loadingStateCallback: (state: LoadingState) => void;
}) {
	logFn(`Fetching ${url}...`);
	const js = await fetch(url).then((res) => res.text());
	logFn(`Parsing fetched content (${js.length} bytes)`);
	const ast = parseJS(js);

	// Modify JSON_game properties
	logFn("[STAGE 2] Filtering");
	loadingStateCallback({
		type: "started",
		mods: mods.map((mod) => ({
			name: mod.name,
			id: mod.id,
			filters: mod.filters.map(
				(filter) => (filter.selector?.type as string) || "sel",
			),
		})),
	});

	// Group filters by AST node type for efficient single-pass processing
	const filtersByType = mods.flatMap((mod, modIndex) =>
		mod.filters
			.map((filter, filterIndex) => ({ mod, modIndex, filter, filterIndex }))
			.filter(x => !!x.filter.selector)
	).reduce((map, { mod, modIndex, filter, filterIndex }) => {
		const nodeType = filter.selector!.type as string;
		if (!map[nodeType]) map[nodeType] = [];
		map[nodeType].push({ 
			modIndex, 
			filterIndex, 
			modId: mod.id,
			selector: filter.selector!, 
			actions: filter.actions 
		});
		return map;
	}, {} as Record<string, Array<{
		modIndex: number;
		filterIndex: number;
		modId: string;
		selector: FilterObject;
		actions: Record<number, Action[]>;
	}>>);

	// Collect program-level actions for later execution
	const programActions: Array<{ mod: Mod; action: Action }> = [];
	for (const mod of mods) {
		loadingStateCallback({
			type: "modStarting",
			modId: mod.id,
			modName: mod.name,
		});
		for (const filter of mod.filters) {
			if (filter.actions.program) {
				for (const action of filter.actions.program) {
					programActions.push({ mod, action });
				}
			}
		}
	}

	// Single-pass traversal with grouped filters
	const visitor = Object.fromEntries(
		Object.entries(filtersByType).map(([nodeType, filterList]) => [
			nodeType,
			(nodePath: NodePath) => {
				const tnode = nodePath.node;
				
				for (const { modIndex, filterIndex, modId, selector, actions } of filterList) {
					const result = checkLevel(tnode, tnode, selector);
					if (!result.result) continue;

					console.log("Found", nodeSummary(tnode));
					
					// Apply actions for each tag
					for (const tagKey of Object.keys(result.tags)) {
						const tagPath = result.tags[tagKey];
						const tagActions = actions[tagKey];
						if (!tagActions) continue;

						let targetNode = tnode;
						let targetPath = nodePath;
						
						// Navigate to the tagged location
						for (const key of tagPath.slice(0, -1)) {
							targetNode = targetNode[key];
							targetPath = typeof key === "number" ? targetPath[key] : targetPath.get(key);
						}

						const finalKey = tagPath.at(-1);
						const finalPath = typeof finalKey === "number" ? targetPath[finalKey] : targetPath.get(finalKey);

						// Apply all actions for this tag
						for (const action of tagActions) {
							applyAction(action, finalKey, targetNode);
						}

						console.log(serializeNodePath(nodePath, finalPath));
					}

					loadingStateCallback({
						type: "filterApplied",
						modId,
						filterIndex,
					});
				}
			}
		])
	);

	// Execute the single traversal
	traverse(ast, visitor);

	// Apply program-level actions
	for (const { mod, action } of programActions) {
		applyAction(action, "body", ast.program);
		loadingStateCallback({
			type: "modFinished",
			modId: mod.id,
			modName: mod.name,
		});
	}

	logFn("[STAGE 2] JSON_game properties modified");

	// Serialize the ast to string
	logFn("Serializing AST");
	const code = `${generate(ast)};window.GameMaker_Init()`;
	logFn("Done");
	return code;
}

function applyAction(action: Action, finalItem: any, node: Node) {
	console.log("Applying action", action);
	switch (action.type) {
		case Actions.Delete:
			if (typeof finalItem === "number") {
				// TODO: no ts-ignore
				// @ts-ignore
				node.splice(finalItem, 1);
			} else {
				delete node[finalItem];
			}
			break;
		case Actions.ReplaceProperty:
			console.log(
				"Replacing",
				node[finalItem],
				action.property,
				"with",
				action.value,
			);
			node[finalItem][action.property] = action.value;
			break;
		case Actions.AddArrayElement:
			if (Array.isArray(node[finalItem])) {
				node[finalItem].push(action.element);
			} else {
				console.error("Cannot add element to non-array node");
			}
			break;
		default:
			console.error("Unknown action type:", action.type);
	}
}
