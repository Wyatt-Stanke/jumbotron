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
	| [typeof Contains, FilterArray | FilterObject, { [Tag]: number}];
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

interface ReplaceSelfAction extends BaseAction {
	type: typeof Actions.ReplaceSelf;
	value: any;
}

interface AddArrayElementAction extends BaseAction {
	type: typeof Actions.AddArrayElement;
	element: any;
}

type Action =
	| DeleteAction
	| ReplacePropertyAction
	| AddArrayElementAction
	| ReplaceSelfAction;

interface Filter {
	selector?: FilterObject;
	actions: Record<number, Action[]> & {
		program?: Action[];
	};
}

interface Mod {
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
	},
	{
		name: "Display OVR",
		id: "display-ovr",
		filters: [
			{
				selector: {
					type: "FunctionDeclaration",
					id: { name: "gml_Object_obj_player_profile_Draw_64" },
					body: {
						type: "BlockStatement",
						body: [
							Contains,
							{
								type: "IfStatement",
								alternate: {
									type: "BlockStatement",
									body: [
										Contains,
										{
											type: "BlockStatement",
											body: [
												Contains,
												{
													type: "ExpressionStatement",
													expression: {
														type: "CallExpression",
														callee: { name: "draw_sprite_ext" },
													},
													[Tag]: 1,
												},
											],
										},
									],
								},
							},
						],
					},
				},
				actions: {
					1: [{ type: Actions.ReplaceProperty, property: "expression", value: parseJSExpression(`
gml_Script_draw_hd_text(
   	_inst,
   	_other,
   	gmltx,
   	gmlty,
   	yyfplus(
   		"OVR ",
   		gml_Script_s_get_player_ovr(_inst, _other, _inst.gmlpmap).toString()
   	)
)`)
						}],
				},
			},
			{
				actions: {
					program: [
						{
							type: Actions.AddArrayElement,
							element: parseJSExpression(`
function gml_Script_s_get_player_ovr(_inst, _other, argument0) {
	{
		var gmlmax_rating = 0;
		var gmlrating = 0;
		var ___sw1046___ = ds_map_find_value(argument0, "position");
		var ___swc1047___ = -1;
		if (yyCompareVal(___sw1046___, 1, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 0;
		} else if (yyCompareVal(___sw1046___, 2, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 1;
		} else if (yyCompareVal(___sw1046___, 3, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 2;
		} else if (yyCompareVal(___sw1046___, 4, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 3;
		} else if (yyCompareVal(___sw1046___, 5, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 4;
		} else if (yyCompareVal(___sw1046___, 6, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 5;
		} else if (yyCompareVal(___sw1046___, 7, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 6;
		} else if (yyCompareVal(___sw1046___, 8, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 7;
		} else if (yyCompareVal(___sw1046___, 9, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 8;
		} else if (yyCompareVal(___sw1046___, 10, g_GMLMathEpsilon, false) == 0) {
			___swc1047___ = 9;
		}
		switch (___swc1047___) {
			case 0: {
				gmlmax_rating = 37;
				break;
			}
			case 1: {
				gmlmax_rating = 34;
				break;
			}
			case 2: {
				gmlmax_rating = 33;
				break;
			}
			case 3: {
				gmlmax_rating = 34;
				break;
			}
			case 4: {
				gmlmax_rating = 35;
				break;
			}
			case 5: {
				gmlmax_rating = 35;
				break;
			}
			case 6: {
				gmlmax_rating = 33;
				break;
			}
			case 7: {
				gmlmax_rating = 33;
				break;
			}
			case 8: {
				gmlmax_rating = 33;
				break;
			}
			case 9: {
				gmlmax_rating = 37;
				break;
			}
		}
		var gmlstm = 0;
		var gmlspd = 0;
		var gmlstr = 0;
		var gmlskl = 0;
		if (yyGetBool(ds_map_exists(argument0, "stamina"))) {
			gmlstm = real(ds_map_find_value(argument0, "stamina"));
		}
		if (yyGetBool(ds_map_exists(argument0, "speed"))) {
			gmlspd = real(ds_map_find_value(argument0, "speed"));
		}
		if (yyGetBool(ds_map_exists(argument0, "strength"))) {
			gmlstr = real(ds_map_find_value(argument0, "strength"));
		}
		if (yyGetBool(ds_map_exists(argument0, "skill"))) {
			gmlskl = real(ds_map_find_value(argument0, "skill"));
		}
		gmlrating = yyfplus(
			yyfplus(
				yyfplus(__yy_gml_errCheck(gmlstm), __yy_gml_errCheck(gmlspd)),
				__yy_gml_errCheck(gmlstr),
			),
			__yy_gml_errCheck(gmlskl),
		);
		gmlrating = round(
			yyfplus(
				yyftime(
					75,
					yyfdivide(
						__yy_gml_errCheck(
							yyftime(
								__yy_gml_errCheck(
									yyfdivide(
										__yy_gml_errCheck(gmlrating),
										__yy_gml_errCheck(gmlmax_rating),
									),
								),
								100,
							),
						),
						100,
					),
				),
				25,
			),
		);
		return gmlrating;
	}
}
								`),
						},
					],
				},
			},
		],
	},
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
	for (const mod of mods) {
		loadingStateCallback({
			type: "modStarting",
			modId: mod.id,
			modName: mod.name,
		});
		for (const [index, filter] of mod.filters.entries()) {
			if (filter.selector) {
				try {
					traverse(ast, {
						[filter.selector.type as string](tnodePath: NodePath) {
							const tnode = tnodePath.node;
							const result = checkLevel(tnode, tnode, filter.selector);
							if (result.result) {
								console.log("Found", nodeSummary(tnode));
								console.log(result.tags[1]);

								for (const tagKey of Object.keys(result.tags)) {
									const tag = result.tags[tagKey];
									let node = tnode;
									for (const key of tag.slice(0, -1)) {
										node = node[key];
									}

									const actions = filter.actions[tagKey];
									const finalItem = tag.at(-1);

									for (const action of actions) {
										applyAction(action, finalItem, node);
									}
								}

								loadingStateCallback({
									type: "filterApplied",
									modId: mod.id,
									filterIndex: index,
								});
								throw new Error("Found");
							}
						},
					});
					throw new Error("Not found");
				} catch (e) {
					if (e.message === "Not found") {
						loadingStateCallback({
							type: "filterFailed",
							modId: mod.id,
							filterIndex: index,
						});
						logFn(`Filter for ${filter.selector.type} not found!`);
						throw e;
					}
					if (e.message !== "Found") {
						throw e;
					}
				}
			}
			if (filter.actions.program) {
				for (const action of filter.actions.program) {
					applyAction(action, "body", ast.program);
				}
			}
		}
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
