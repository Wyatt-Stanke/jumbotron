import { parseJS, generate, type types } from "@jumbotron/parser";
import traverse, { type Node, type NodePath } from "@babel/traverse";
import { parseJSExpression } from "@jumbotron/parser";
import { version } from "../package.json";
import {
	Contains,
	TagSymbol,
	Actions,
	SubstitutionPrimitives,
	ObjectPrimitives,
	tag,
} from "@jumbotron/injector-symbols";
import { f } from "./fluent";
import { Override } from "./mixin";
import {
	Mod,
	Action,
	FilterObject,
	AddArrayElementPosition,
} from "@jumbotron/injector-mod-format";

const flattenObject = (
	obj: Record<string, unknown>,
	delimiter = ".",
	prefix = "",
) => {
	const keys = Object.keys(obj);

	return keys.reduce((acc, k) => {
		const pre = prefix.length ? `${prefix}${delimiter}` : "";
		if (
			typeof obj[k] === "object" &&
			obj[k] !== null &&
			Object.keys(obj[k]).length > 0
		)
			Object.assign(
				acc,
				flattenObject(obj[k] as Record<string, unknown>, delimiter, pre + k),
			);
		else acc[pre + k] = obj[k];
		return acc;
	}, {});
};

const isObject = (obj: unknown): obj is Record<string, unknown> =>
	obj.constructor.name === "Object";

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
		if (filter[TagSymbol]) {
			tags[filter[TagSymbol].inner] = history;
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

function followTagPath(
	basePath: NodePath,
	tagPath: (string | number)[],
): NodePath {
	let currentPath = basePath;
	for (const key of tagPath) {
		currentPath =
			typeof key === "number" ? currentPath[key] : currentPath.get(key);
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
	mods,
}: {
	url: string;
	logFn: (message: string) => void;
	loadingStateCallback: (state: LoadingState) => void;
	mods: Mod[];
}) {
	logFn(`Fetching ${url}...`);
	const js = await fetch(url).then((res) => res.text());
	logFn(`Parsing fetched content (${js.length} bytes)`);
	const ast = parseJS(js);

	// Modify JSON_game properties
	const startTime = Date.now();
	logFn("[STAGE 2] Filtering");
	loadingStateCallback({
		type: "started",
		mods: mods.map((mod) => ({
			name: mod.name,
			id: mod.id,
			filters: mod.filters
				.flat()
				.map((filter) => (filter.selector?.type as string) || "sel"),
		})),
	});

	// Group filters by AST node type for efficient single-pass processing
	const filtersByType = mods
		.flatMap((mod, modIndex) =>
			mod.filters
				.flat()
				.map((filter, filterIndex) => ({ mod, modIndex, filter, filterIndex }))
				.filter((x) => !!x.filter.selector),
		)
		.reduce(
			(map, { mod, modIndex, filter, filterIndex }) => {
				const nodeType = filter.selector!.type as string;
				if (!map[nodeType]) map[nodeType] = [];
				map[nodeType].push({
					modIndex,
					filterIndex,
					modId: mod.id,
					selector: filter.selector!,
					actions: filter.actions,
				});
				return map;
			},
			{} as Record<
				string,
				Array<{
					modIndex: number;
					filterIndex: number;
					modId: string;
					selector: FilterObject;
					actions: Record<number, Action[]>;
				}>
			>,
		);

	// Collect program-level actions for later execution
	const programActions: Array<{ mod: Mod; action: Action }> = [];
	for (const mod of mods) {
		loadingStateCallback({
			type: "modStarting",
			modId: mod.id,
			modName: mod.name,
		});
		for (const filter of mod.filters.flat()) {
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

				for (const {
					modIndex,
					filterIndex,
					modId,
					selector,
					actions,
				} of filterList) {
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
							targetPath =
								typeof key === "number" ? targetPath[key] : targetPath.get(key);
						}

						const finalKey = tagPath.at(-1);
						const finalPath =
							typeof finalKey === "number"
								? targetPath[finalKey]
								: targetPath.get(finalKey);

						// Apply all actions for this tag
						for (const action of tagActions) {
							applyAction(
								{
									modId,
								},
								action,
								finalKey,
								targetNode,
							);
						}

						console.log(serializeNodePath(nodePath, finalPath));
					}

					loadingStateCallback({
						type: "filterApplied",
						modId,
						filterIndex,
					});
				}
			},
		]),
	);

	// Execute the single traversal
	traverse(ast, visitor);

	// Apply program-level actions
	for (const { mod, action } of programActions) {
		applyAction(
			{
				modId: mod.id,
			},
			action,
			"body",
			ast.program,
		);
		loadingStateCallback({
			type: "modFinished",
			modId: mod.id,
			modName: mod.name,
		});
	}

	logFn(
		`[STAGE 2] JSON_game properties modified in ${Date.now() - startTime}ms`,
	);

	// Serialize the ast to string
	logFn("Serializing AST");
	const code = `${generate(ast)};window.GameMaker_Init()`;
	logFn("Done");
	return code;
}

function makeStringJavascriptSafe(input: string): string {
	// Make the string safe to be a JavaScript identifier (variable/function name)
	return input
		.replace(/[^a-zA-Z0-9_$]/g, "_") // Replace non-alphanumeric characters with underscores
		.replace(/^\d/, "_$&"); // If it starts with a digit, prepend an underscore
}

interface Context {
	modId: string;
}

function applyUniqueSafeStringPrimitive(context: Context, p1: string): string {
	// p1 is the captured identifier from the regex (e.g., "1" or "identifier")
	// For backward compatibility, try splitting by comma if it contains one (old format)
	const identifier = p1.includes(",") ? p1.split(",")[1] : p1;
	const safeModId = makeStringJavascriptSafe(context.modId);
	const safeIdentifier = makeStringJavascriptSafe(identifier);
	// Ensure single underscore separator: if safeIdentifier starts with underscore (from digit), don't add another
	const separator = safeIdentifier.startsWith("_") ? "" : "_";
	return `$$JUMBOTRON$$_uniqueString_${safeModId}${separator}${safeIdentifier}`;
}

function applyParseJSExpressionPrimitive(
	context: Context,
	p1: string,
): Record<any, any> {
	const [, x] = p1.split("$");
	try {
		return parseJSExpression(x);
	} catch (e) {
		console.error(
			`Failed to parse JS expression "${x}" in mod ${context.modId}:`,
			e,
		);
		return {};
	}
}

function applyPrimitives(
	context: Context,
	input: string | Record<string, any> | any[],
): any {
	// Match both formats: __Primitives_UniqueSafeString,id__ and Primitives_UniqueSafeString$id__
	// Use lookahead to not consume the trailing __
	const regex = new RegExp(
		String.raw`${SubstitutionPrimitives.UniqueSafeString.replace(".", "\\.")}[\$,]([^_]+)(?=__)`,
		"g",
	);

	if (typeof input === "string") {
		return input.replace(regex, (match, p1) =>
			applyUniqueSafeStringPrimitive(context, p1),
		);
	} else if (Array.isArray(input)) {
		return input.map((item) => applyPrimitives(context, item));
	} else if (input && typeof input === "object") {
		const result: Record<string, any> = {};
		if (input[ObjectPrimitives.ParseJSExpression]) {
			input = applyParseJSExpressionPrimitive(
				context,
				input[ObjectPrimitives.ParseJSExpression],
			);
		}
		for (const [key, value] of Object.entries(input)) {
			// Apply primitives to the key if it's a string
			const newKey = applyPrimitives(context, key);
			result[newKey] = applyPrimitives(context, value);
		}
		return result;
	}
	return input;
}

function applyAction(
	context: Context,
	action: Action,
	finalItem: any,
	node: Node,
) {
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
			let value = applyPrimitives(context, action.value);
			console.log("Replacing", node[finalItem], action.property, "with", value);
			node[finalItem][action.property] = value;
			break;
		case Actions.AddArrayElement:
			console.log(action.element);
			let element = applyPrimitives(context, action.element);
			console.log(element);
			if (Array.isArray(node[finalItem])) {
				if (action.position === AddArrayElementPosition.Start) {
					node[finalItem].unshift(element);
				} else {
					node[finalItem].push(element);
				}
			} else {
				console.error("Cannot add element to non-array node");
			}
			break;
		default:
			console.error("Unknown action type:", action.type);
	}
}
