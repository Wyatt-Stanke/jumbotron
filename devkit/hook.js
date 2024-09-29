import { parse } from "https://esm.run/acorn";
import { simple as walkSimple, ancestor as walkAncestor } from "https://cdn.jsdelivr.net/npm/acorn-walk@8.2.0/dist/walk.mjs";
import { generate } from "https://cdn.jsdelivr.net/npm/astring@1.8.1/dist/astring.mjs";

const flattenObject = (obj, delimiter = '.', prefix = '') =>
  Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? `${prefix}${delimiter}` : '';
    if (
      typeof obj[k] === 'object' &&
      obj[k] !== null &&
      Object.keys(obj[k]).length > 0
    )
      Object.assign(acc, flattenObject(obj[k], delimiter, pre + k));
    else acc[pre + k] = obj[k];
    return acc;
  }, {});

const filters = [
  {
    selector: {
		type: "VariableDeclarator",
		init: {
			type: "ObjectExpression",
			properties: [
				{
					key: { name: "Extensions" },
					value: { 
						type: "ArrayExpression",
						elements: [
							{
								type: "ObjectExpression",
								properties: [
									{ 
										key: { name: "name" }, 
										value: { value: "Poki" }
									}
								]
							}
						]
					},
				}
			]
		}
	}
  },
];

export async function createHooks({ url, logFn }) {
	logFn(`Fetching ${url}...`);
	const js = await fetch(url).then((res) => res.text());
	logFn(`Parsing fetched content (${js.length} bytes)`);
	const ast = parse(js, { ecmaVersion: "latest" });
	logFn("[STAGE 1] Walking AST");
	const hooks = [];
	walkSimple(ast, {
		FunctionDeclaration(node) {
			hooks.push(node.id.name);
		},
	});
	console.log(hooks);
	logFn(`[STAGE 1] AST walked - ${hooks.length} hooks found`);
	
	// Modify JSON_game properties
	logFn("[STAGE 2] Filtering");
	for (const filter of filters) {
		const flatFilter = flattenObject(filter.selector);
		walkSimple(ast, {
			[filter.selector.type](node) {
				const flat = flattenObject(node);
				console.log(flat, flatFilter);
				for (const [key, value] of Object.entries(flatFilter)) {
					if (flat[key] !== value) {
						return;
					}
				}
			}
		})
	}
	logFn("[STAGE 2] JSON_game properties modified");

	// Serialize the ast to string
	logFn("Serializing AST");
	const code = generate(ast) + ";window.GameMaker_Init()";
	logFn("Done");
	return code;
}
