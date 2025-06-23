import { parse, parseExpression } from "@babel/parser";
import generateBabel from "@babel/generator";
import type { File, Expression } from "@babel/types";

export function parseJS(code: string): File {
	const result = parse(code, { sourceType: "script" });
	if (result.errors.length > 0) {
		console.log(result.errors);
		throw new Error(result.errors.toString());
	}

	return result;
}

export function parseJSExpression(code: string): Expression {
	const result = parseExpression(code, { sourceType: "script" });
	if (result.errors.length > 0) {
		throw new Error(result.errors.toString());
	}

	return result;
}

export function parseTS(code: string): File {
	const result = parse(code, {
		sourceType: "script",
		plugins: ["typescript"],
	});
	if (result.errors.length > 0) {
		throw new Error(result.errors.toString());
	}

	return result;
}

export function generate(code: File): string {
	return generateBabel(code).code;
}

export * as types from "@babel/types";
