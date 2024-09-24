import { parse } from 'https://cdn.jsdelivr.net/npm/acorn@8.7.1/dist/acorn.mjs';
import { simple as walkSimple } from 'https://cdn.jsdelivr.net/npm/acorn-walk@8.2.0/dist/walk.mjs';
import { generate } from 'https://cdn.jsdelivr.net/npm/astring@1.8.1/dist/astring.mjs';

export async function createHooks({url, logFn}) {
    logFn(`Fetching ${url}...`)
    const js = await fetch(url).then(res => res.text());
    logFn(`Parsing fetched content (${js.length} bytes)`)
    const ast = parse(js, { ecmaVersion: 'latest' });
    logFn("[STAGE 1] Walking AST")
    const hooks = [];
    walkSimple(ast, {
        FunctionDeclaration(node) {
            hooks.push(node.id.name);
        }
    });
    console.log(hooks);
    logFn(`[STAGE 1] AST walked - ${hooks.length} hooks found`)
    // Serialize the ast to string
    logFn("Serializing AST")
    const code = generate(ast) + ";window.GameMaker_Init()";
    logFn("Done")
    return code;
}