import assert from "node:assert";
import { describe, it } from "node:test";
import { TagSymbol, tag } from "@jumbotron/injector-symbols";
import { f } from "./fluent.ts";

describe("Fluent API", () => {
	describe("f.function", () => {
		it("should create a function declaration selector without tag", () => {
			const selector = f.function("myFunction");
			assert.strictEqual(selector.type, "FunctionDeclaration");
			assert.strictEqual(selector.id.name, "myFunction");
			assert.strictEqual(selector.id[TagSymbol], undefined);
		});

		it("should create a function declaration selector with tag", () => {
			const testTag = tag(1);
			const selector = f.function("myFunction", testTag);
			assert.strictEqual(selector.type, "FunctionDeclaration");
			assert.strictEqual(selector.id.name, "myFunction");
			assert.strictEqual(selector.id[TagSymbol], testTag);
		});
	});

	describe("f.boolean", () => {
		it("should create a boolean literal for true", () => {
			const selector = f.boolean(true);
			assert.strictEqual(selector.type, "BooleanLiteral");
			assert.strictEqual(selector.value, true);
		});

		it("should create a boolean literal for false", () => {
			const selector = f.boolean(false);
			assert.strictEqual(selector.type, "BooleanLiteral");
			assert.strictEqual(selector.value, false);
		});

		it("should create a boolean literal with tag", () => {
			const testTag = tag(2);
			const selector = f.boolean(true, testTag);
			assert.strictEqual(selector[TagSymbol], testTag);
		});
	});

	describe("f.true", () => {
		it("should create a true boolean literal", () => {
			const selector = f.true();
			assert.strictEqual(selector.type, "BooleanLiteral");
			assert.strictEqual(selector.value, true);
		});

		it("should create a true boolean literal with tag", () => {
			const testTag = tag(3);
			const selector = f.true(testTag);
			assert.strictEqual(selector.value, true);
			assert.strictEqual(selector[TagSymbol], testTag);
		});
	});

	describe("f.false", () => {
		it("should create a false boolean literal", () => {
			const selector = f.false();
			assert.strictEqual(selector.type, "BooleanLiteral");
			assert.strictEqual(selector.value, false);
		});

		it("should create a false boolean literal with tag", () => {
			const testTag = tag(4);
			const selector = f.false(testTag);
			assert.strictEqual(selector.value, false);
			assert.strictEqual(selector[TagSymbol], testTag);
		});
	});

	describe("f.variableDeclarator", () => {
		it("should create a variable declarator selector", () => {
			const init = { type: "Identifier", name: "x" };
			const selector = f.variableDeclarator(init);
			assert.strictEqual(selector.type, "VariableDeclarator");
			assert.deepStrictEqual(selector.init, init);
		});

		it("should create a variable declarator selector with tag", () => {
			const testTag = tag(5);
			const init = { type: "Identifier", name: "y" };
			const selector = f.variableDeclarator(init, testTag);
			assert.strictEqual(selector.type, "VariableDeclarator");
			assert.strictEqual(selector[TagSymbol], testTag);
		});

		it("should handle complex init objects", () => {
			const init = {
				type: "ObjectExpression",
				properties: [
					{
						key: { name: "test" },
						value: { value: 123 },
					},
				],
			};
			const selector = f.variableDeclarator(init);
			assert.strictEqual(selector.type, "VariableDeclarator");
			assert.deepStrictEqual(selector.init, init);
		});
	});
});
