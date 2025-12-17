import assert from "node:assert";
import { describe, it } from "node:test";
import { generate, parseJS, parseJSExpression, parseTS } from "./index.ts";

describe("Parser", () => {
	describe("parseJS", () => {
		it("should parse simple JavaScript code", () => {
			const code = "const x = 42;";
			const ast = parseJS(code);
			assert.strictEqual(ast.type, "File");
			assert.ok(ast.program);
			assert.strictEqual(ast.program.type, "Program");
		});

		it("should parse function declarations", () => {
			const code = "function add(a, b) { return a + b; }";
			const ast = parseJS(code);
			assert.strictEqual(ast.program.body.length, 1);
			assert.strictEqual(ast.program.body[0].type, "FunctionDeclaration");
		});

		it("should throw error on invalid syntax", () => {
			const code = "const x = ;";
			assert.throws(() => parseJS(code), Error);
		});
	});

	describe("parseJSExpression", () => {
		it("should parse simple expressions", () => {
			const code = "1 + 2";
			const expr = parseJSExpression(code);
			assert.strictEqual(expr.type, "BinaryExpression");
		});

		it("should parse object literals", () => {
			const code = "{ a: 1, b: 2 }";
			const expr = parseJSExpression(code);
			assert.strictEqual(expr.type, "ObjectExpression");
		});

		it("should throw error on invalid expression", () => {
			const code = "function";
			assert.throws(() => parseJSExpression(code), Error);
		});
	});

	describe("parseTS", () => {
		it("should parse TypeScript code with type annotations", () => {
			const code = "const x: number = 42;";
			const ast = parseTS(code);
			assert.strictEqual(ast.type, "File");
			assert.ok(ast.program);
		});

		it("should parse interfaces", () => {
			const code = "interface User { name: string; age: number; }";
			const ast = parseTS(code);
			assert.strictEqual(ast.program.body.length, 1);
			assert.strictEqual(ast.program.body[0].type, "TSInterfaceDeclaration");
		});

		it("should throw error on invalid TypeScript syntax", () => {
			const code = "interface {";
			assert.throws(() => parseTS(code), Error);
		});
	});

	describe("generate", () => {
		it("should generate JavaScript code from AST", () => {
			const code = "const x = 42;";
			const ast = parseJS(code);
			const generated = generate(ast);
			assert.ok(generated.includes("x"));
			assert.ok(generated.includes("42"));
		});

		it("should generate code for functions", () => {
			const code = "function test() { return true; }";
			const ast = parseJS(code);
			const generated = generate(ast);
			assert.ok(generated.includes("function"));
			assert.ok(generated.includes("test"));
			assert.ok(generated.includes("return"));
		});

		it("should roundtrip simple code", () => {
			const code = "const x = 42;";
			const ast = parseJS(code);
			const generated = generate(ast);
			const ast2 = parseJS(generated);
			// Both ASTs should have the same structure
			assert.strictEqual(ast2.type, ast.type);
			assert.strictEqual(ast2.program.type, ast.program.type);
		});
	});
});
