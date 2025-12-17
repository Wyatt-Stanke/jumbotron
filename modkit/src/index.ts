import fs from "node:fs";
import type { Mod } from "@jumbotron/injector-mod-format";
import { Actions, Contains, TagSymbol, tag } from "@jumbotron/injector-symbols";
import { version } from "../package.json";
import { f } from "./fluent";
import { Override } from "./mixin";

const mods: Mod[] = [
	{
		name: "Jettison Poki",
		id: "jettison-poki",
		filters: [
			{
				selector: f.variableDeclarator({
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
										[TagSymbol]: tag(1),
									},
								],
							},
						},
					],
				}),
				actions: {
					1: [{ type: Actions.Delete }],
				},
			},
			{
				selector: f.variableDeclarator({
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
										[TagSymbol]: tag(1),
									},
								],
							},
						},
					],
				}),
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
						right: f.true(tag(1)),
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
			new Override(
				"gml_Script_s_get_gm_version",
				(ctx, ...args) => {
					return `${ctx.original(...args)}\nJumbotron ${ctx.inputs.version}`;
				},
				{ inputs: { version } },
			).compile(),
		],
	},
];

export function serializeMod(mod: Mod): string {
	// Replace all instances of the `TagSymbol` as a key with the text "_tag"
	// biome-ignore lint/suspicious/noExplicitAny: Function handles dynamic mod structures
	const replaceTagSymbol = (obj: any) => {
		if (Array.isArray(obj)) {
			return obj.map(replaceTagSymbol);
		}
		if (typeof obj === "object" && obj !== null) {
			// biome-ignore lint/suspicious/noExplicitAny: Object structure is dynamic
			const newObj: any = {};
			if (obj[TagSymbol]) {
				newObj._tag = obj[TagSymbol].inner;
				delete obj[TagSymbol];
			}
			for (const key in obj) {
				newObj[key] = replaceTagSymbol(obj[key]);
			}
			return newObj;
		}
		return obj;
	};
	const serializedMod = replaceTagSymbol(mod);
	return JSON.stringify(serializedMod, null, 2);
}

function exportMods(mods: Mod[]): void {
	// Export mods as JSON and write each mod to a separate file
	mods.forEach((mod) => {
		const modJson = serializeMod(mod);
		const fileName = `${mod.id}.jb.json`;
		fs.writeFileSync(fileName, modJson, "utf8");
		console.log(`Exported mod: ${fileName}`);
		// Compressed version
		// const modJsonCompressed = JSON.stringify(JSON.parse(modJson));
		// const compressedFileName = `${mod.id}.json.cm`;
		// const compressedData = zlib.gzipSync(modJsonCompressed);
		// fs.writeFileSync(compressedFileName, compressedData);
	});
}

exportMods(mods);
