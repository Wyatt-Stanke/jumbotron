import assert from "node:assert";
import { describe, it } from "node:test";
import {
	applyPrimitives,
	type Context,
	makeStringJavascriptSafe,
} from "./hook.ts";

describe("Primitive Substitution", () => {
	const context: Context = { modId: "test-mod" };

	describe("makeStringJavascriptSafe", () => {
		it("should replace non-alphanumeric characters with underscores", () => {
			const result = makeStringJavascriptSafe("test-mod");
			assert.strictEqual(result, "test_mod");
		});

		it("should prepend underscore to identifiers starting with digit", () => {
			const result = makeStringJavascriptSafe("1test");
			assert.strictEqual(result, "_1test");
		});

		it("should handle already safe identifiers", () => {
			const result = makeStringJavascriptSafe("testMod_123");
			assert.strictEqual(result, "testMod_123");
		});

		it("should handle special characters", () => {
			const result = makeStringJavascriptSafe("test@mod#123");
			assert.strictEqual(result, "test_mod_123");
		});

		it("should allow dollar signs", () => {
			const result = makeStringJavascriptSafe("$test");
			assert.strictEqual(result, "$test");
		});
	});

	describe("applyPrimitives - String substitution", () => {
		describe("New format (dollar separator)", () => {
			it("should substitute primitive with single digit identifier", () => {
				const input =
					"__jumbotron_orig__Primitives_UniqueSafeString$1__$$gml_Script";
				const result = applyPrimitives(context, input);
				assert.strictEqual(
					result,
					"__jumbotron_orig__$$JUMBOTRON$$_uniqueString_test_mod_1__$$gml_Script",
				);
			});

			it("should substitute primitive with identifier containing underscores", () => {
				const input = "Primitives_UniqueSafeString$my_func__";
				const result = applyPrimitives(context, input);
				assert.strictEqual(
					result,
					"$$JUMBOTRON$$_uniqueString_test_mod_my_func__",
				);
			});

			it("should substitute primitive with alphanumeric identifier", () => {
				const input = "Primitives_UniqueSafeString$test123__";
				const result = applyPrimitives(context, input);
				assert.strictEqual(
					result,
					"$$JUMBOTRON$$_uniqueString_test_mod_test123__",
				);
			});

			it("should preserve trailing delimiter", () => {
				const input = "prefix__Primitives_UniqueSafeString$id__$$suffix";
				const result = applyPrimitives(context, input);
				assert.strictEqual(
					result,
					"prefix__$$JUMBOTRON$$_uniqueString_test_mod_id__$$suffix",
				);
			});

			it("should handle multiple primitives in same string", () => {
				const input =
					"Primitives_UniqueSafeString$first__$$Primitives_UniqueSafeString$second__";
				const result = applyPrimitives(context, input);
				assert.strictEqual(
					result,
					"$$JUMBOTRON$$_uniqueString_test_mod_first__$$$$JUMBOTRON$$_uniqueString_test_mod_second__",
				);
			});
		});

		describe("Old format (comma separator)", () => {
			it("should substitute old format with leading underscores", () => {
				const input = "__Primitives_UniqueSafeString,test__";
				const result = applyPrimitives(context, input);
				assert.strictEqual(
					result,
					"$$JUMBOTRON$$_uniqueString_test_mod_test__",
				);
			});

			it("should substitute old format with identifier containing underscores", () => {
				const input = "__Primitives_UniqueSafeString,my_id__";
				const result = applyPrimitives(context, input);
				assert.strictEqual(
					result,
					"$$JUMBOTRON$$_uniqueString_test_mod_my_id__",
				);
			});

			it("should substitute old format with digit identifier", () => {
				const input = "__Primitives_UniqueSafeString,1__";
				const result = applyPrimitives(context, input);
				assert.strictEqual(result, "$$JUMBOTRON$$_uniqueString_test_mod_1__");
			});
		});

		describe("Separator handling", () => {
			it("should avoid double underscores when identifier starts with digit", () => {
				const input = "Primitives_UniqueSafeString$1__";
				const result = applyPrimitives(context, input);
				// "1" becomes "_1" after makeStringJavascriptSafe
				// Should be "test_mod_1" not "test_mod__1"
				assert.strictEqual(result, "$$JUMBOTRON$$_uniqueString_test_mod_1__");
			});

			it("should add single underscore separator for alphanumeric identifiers", () => {
				const input = "Primitives_UniqueSafeString$myFunc__";
				const result = applyPrimitives(context, input);
				assert.strictEqual(
					result,
					"$$JUMBOTRON$$_uniqueString_test_mod_myFunc__",
				);
			});
		});

		describe("Context variations", () => {
			it("should handle context with special characters in modId", () => {
				const specialContext: Context = { modId: "my-special-mod" };
				const input = "Primitives_UniqueSafeString$test__";
				const result = applyPrimitives(specialContext, input);
				assert.strictEqual(
					result,
					"$$JUMBOTRON$$_uniqueString_my_special_mod_test__",
				);
			});

			it("should handle context with digit-starting modId", () => {
				const digitContext: Context = { modId: "123-mod" };
				const input = "Primitives_UniqueSafeString$test__";
				const result = applyPrimitives(digitContext, input);
				assert.strictEqual(
					result,
					"$$JUMBOTRON$$_uniqueString__123_mod_test__",
				);
			});
		});

		describe("Edge cases", () => {
			it("should not modify strings without primitives", () => {
				const input = "regular_function_name";
				const result = applyPrimitives(context, input);
				assert.strictEqual(result, "regular_function_name");
			});

			it("should not modify strings with incomplete primitive patterns", () => {
				const input = "Primitives_UniqueSafeString$incomplete";
				const result = applyPrimitives(context, input);
				assert.strictEqual(result, "Primitives_UniqueSafeString$incomplete");
			});

			it("should handle empty string", () => {
				const result = applyPrimitives(context, "");
				assert.strictEqual(result, "");
			});
		});
	});

	describe("applyPrimitives - Array substitution", () => {
		it("should apply primitives to all array elements", () => {
			const input = [
				"Primitives_UniqueSafeString$a__",
				"Primitives_UniqueSafeString$b__",
			];
			const result = applyPrimitives(context, input);
			assert.deepStrictEqual(result, [
				"$$JUMBOTRON$$_uniqueString_test_mod_a__",
				"$$JUMBOTRON$$_uniqueString_test_mod_b__",
			]);
		});

		it("should handle mixed array with primitives and regular strings", () => {
			const input = ["Primitives_UniqueSafeString$test__", "regular_string"];
			const result = applyPrimitives(context, input);
			assert.deepStrictEqual(result, [
				"$$JUMBOTRON$$_uniqueString_test_mod_test__",
				"regular_string",
			]);
		});

		it("should handle empty array", () => {
			const result = applyPrimitives(context, []);
			assert.deepStrictEqual(result, []);
		});
	});

	describe("applyPrimitives - Object substitution", () => {
		it("should apply primitives to object values", () => {
			const input = {
				name: "Primitives_UniqueSafeString$test__",
			};
			const result = applyPrimitives(context, input);
			assert.deepStrictEqual(result, {
				name: "$$JUMBOTRON$$_uniqueString_test_mod_test__",
			});
		});

		it("should apply primitives to object keys", () => {
			const input = {
				Primitives_UniqueSafeString$key__: "value",
			};
			const result = applyPrimitives(context, input);
			assert.deepStrictEqual(result, {
				$$JUMBOTRON$$_uniqueString_test_mod_key__: "value",
			});
		});

		it("should apply primitives recursively to nested objects", () => {
			const input = {
				outer: {
					inner: "Primitives_UniqueSafeString$nested__",
				},
			};
			const result = applyPrimitives(context, input);
			assert.deepStrictEqual(result, {
				outer: {
					inner: "$$JUMBOTRON$$_uniqueString_test_mod_nested__",
				},
			});
		});

		it("should handle objects with mixed types", () => {
			const input = {
				str: "Primitives_UniqueSafeString$test__",
				num: 42,
				bool: true,
				arr: ["Primitives_UniqueSafeString$arr__"],
			};
			const result = applyPrimitives(context, input);
			assert.deepStrictEqual(result, {
				str: "$$JUMBOTRON$$_uniqueString_test_mod_test__",
				num: 42,
				bool: true,
				arr: ["$$JUMBOTRON$$_uniqueString_test_mod_arr__"],
			});
		});

		it("should handle empty object", () => {
			const result = applyPrimitives(context, {});
			assert.deepStrictEqual(result, {});
		});
	});

	describe("applyPrimitives - Type handling", () => {
		it("should return non-string, non-array, non-object values unchanged", () => {
			assert.strictEqual(applyPrimitives(context, 42), 42);
			assert.strictEqual(applyPrimitives(context, true), true);
			assert.strictEqual(applyPrimitives(context, null), null);
			assert.strictEqual(applyPrimitives(context, undefined), undefined);
		});
	});

	describe("Backward compatibility", () => {
		it("should support both old and new formats in same input", () => {
			const input =
				"__Primitives_UniqueSafeString,old__$$Primitives_UniqueSafeString$new__";
			const result = applyPrimitives(context, input);
			assert.strictEqual(
				result,
				"$$JUMBOTRON$$_uniqueString_test_mod_old__$$$$JUMBOTRON$$_uniqueString_test_mod_new__",
			);
		});
	});

	describe("Real-world example from mod file", () => {
		it("should substitute primitive in function name as used in show-jumbotron-version mod", () => {
			const realContext: Context = { modId: "show-jumbotron-version" };
			const input =
				"__jumbotron_orig__Primitives_UniqueSafeString$1__$$gml_Script_s_get_gm_version";
			const result = applyPrimitives(realContext, input);
			assert.strictEqual(
				result,
				"__jumbotron_orig__$$JUMBOTRON$$_uniqueString_show_jumbotron_version_1__$$gml_Script_s_get_gm_version",
			);
		});
	});
});
