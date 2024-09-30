import { parse } from "https://esm.run/acorn";
import {
  simple as walkSimple,
  ancestor as walkAncestor,
} from "https://cdn.jsdelivr.net/npm/acorn-walk@8.2.0/dist/walk.mjs";
import { generate } from "https://cdn.jsdelivr.net/npm/astring@1.8.1/dist/astring.mjs";

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

const isObject = (obj) => obj.constructor.name === "Object";

const Contains = Symbol("Contains");
const Tag = Symbol("Tag");

const filters = [
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
  },
];

console.log(filter.build(), filters[0].selector);

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
  let current = 0;
  for (const filter of filters) {
    walkSimple(ast, {
      [filter.selector.type](tnode) {
        current++;
        if (current >= 20) return;

        console.log("Checking", tnode.id.name);

        function checkLevel(node, filter, history = [], tags = {}) {
          if (isObject(filter)) {
            for (const [key, value] of Object.entries(filter)) {
              console.log(filter, value);
              if (!node || node[key] === undefined) {
                console.log(
                  `${tnode.id.name} does not have ${[...history, key].join(
                    "."
                  )}`
                );
                return { result: false };
              }
              if (isObject(value) || Array.isArray(value)) {
                if (
                  !checkLevel(node[key], value, [...history, key], tags).result
                ) {
                  return { result: false };
                }
              } else {
                if (node[key] !== value) {
                  console.log(
                    `${tnode.id.name} does not have ${[...history, key].join(
                      "."
                    )} = ${value} (got ${node[key]})`
                  );
                  return { result: false };
                }
              }
            }
            if (filter[Tag]) {
              tags[filter[Tag]] = node;
            }
            return { result: true, tags };
          }
          if (Array.isArray(filter) && Array.isArray(node)) {
            const [operator, ...rest] = filter;
            if (operator === Contains) {
              for (const item of node) {
                if (
                  checkLevel(item, rest[0], [...history, "[contains]"], tags)
                    .result
                )
                  return { result: true, tags };
              }
              console.log(
                `${tnode.id.name} does not contain ${[...history, "[]"].join(
                  "."
                )}`
              );
              return { result: false };
            }
          }
          return { result: true, tags };
        }

        let result = checkLevel(tnode, filter.selector);
        if (result.result) {
          console.log("Found", tnode.id.name);
          console.log(result.tags[1]);
          result.tags[1] = {};
        }
      },
    });
  }
  logFn("[STAGE 2] JSON_game properties modified");

  // Serialize the ast to string
  logFn("Serializing AST");
  const code = generate(ast) + ";window.GameMaker_Init()";
  logFn("Done");
  return code;
}
