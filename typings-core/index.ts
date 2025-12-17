import type * as rb from "./RetroBowl-raw";

type RB = typeof rb;

// biome-ignore lint/suspicious/noExplicitAny: Type utility requires any for generic function type detection
type IsFunction<T> = T extends (...args: any[]) => any ? true : false;

type IsNotAny<T> = 0 extends 1 & T ? false : true;

type IsFunctionAndNotAny<T> =
	IsFunction<T> extends true
		? IsNotAny<T> extends true
			? true
			: false
		: false;

type FunctionKeys<T> = {
	[K in keyof T]: IsFunctionAndNotAny<T[K]> extends true ? K : never;
}[keyof T];

export type RBFunctions = Pick<RB, FunctionKeys<RB>>;
// export type RBFunctionNames = keyof RBFunctions;
export type { FunctionNames as RBFunctionNames } from "./RetroBowl-precomputed";
