import { describe, it } from "node:test";
import assert from "node:assert";
import {
	Contains,
	TagSymbol,
	Actions,
	SubstitutionPrimitives,
	ObjectPrimitives,
	Tag,
	tag,
} from "./index.ts";

describe("Injector Symbols", () => {
	describe("Constants", () => {
		it("should export Contains constant", () => {
			assert.strictEqual(Contains, "Contains");
		});

		it("should export TagSymbol as a Symbol", () => {
			assert.strictEqual(typeof TagSymbol, "symbol");
			assert.strictEqual(TagSymbol.toString(), "Symbol(Tag)");
		});
	});

	describe("Actions", () => {
		it("should have Delete action", () => {
			assert.strictEqual(Actions.Delete, "Actions_Delete");
		});

		it("should have ReplaceProperty action", () => {
			assert.strictEqual(Actions.ReplaceProperty, "Actions_ReplaceProperty");
		});

		it("should have AddArrayElement action", () => {
			assert.strictEqual(Actions.AddArrayElement, "Actions_AddArrayElement");
		});

		it("should have ReplaceSelf action", () => {
			assert.strictEqual(Actions.ReplaceSelf, "Actions_ReplaceSelf");
		});
	});

	describe("SubstitutionPrimitives", () => {
		it("should have UniqueSafeString primitive", () => {
			assert.strictEqual(
				SubstitutionPrimitives.UniqueSafeString,
				"Primitives_UniqueSafeString",
			);
		});
	});

	describe("ObjectPrimitives", () => {
		it("should have ParseJSExpression primitive", () => {
			assert.strictEqual(
				ObjectPrimitives.ParseJSExpression,
				"Primitives_ParseJSExpression",
			);
		});
	});

	describe("Tag class", () => {
		it("should create a Tag with numeric inner value", () => {
			const testTag = new Tag(42);
			assert.strictEqual(testTag.inner, 42);
		});

		it("should create a Tag with string inner value", () => {
			const testTag = new Tag("test-tag");
			assert.strictEqual(testTag.inner, "test-tag");
		});
	});

	describe("tag function", () => {
		it("should create a Tag with numeric value", () => {
			const testTag = tag(123);
			assert.ok(testTag instanceof Tag);
			assert.strictEqual(testTag.inner, 123);
		});

		it("should create a Tag with string value", () => {
			const testTag = tag("my-tag");
			assert.ok(testTag instanceof Tag);
			assert.strictEqual(testTag.inner, "my-tag");
		});

		it("should create different Tag instances for same values", () => {
			const tag1 = tag(1);
			const tag2 = tag(1);
			assert.notStrictEqual(tag1, tag2);
			assert.strictEqual(tag1.inner, tag2.inner);
		});
	});
});
