import {
	type Actions,
	type Contains,
	type Tag,
	TagSymbol,
} from "@jumbotron/injector-symbols";

// TODO: use a better type system that uses the actual AST types
type Key = string | number | boolean;
type FilterArray =
	| [typeof Contains, FilterArray | FilterObject]
	| [typeof Contains, FilterArray | FilterObject, { [TagSymbol]: Tag }];
export interface FilterObject
	extends Record<string, FilterArray | FilterObject | Key> {
	[TagSymbol]?: Tag;
}

export interface BaseAction {
	type: (typeof Actions)[keyof typeof Actions];
}

export interface DeleteAction extends BaseAction {
	type: typeof Actions.Delete;
}

export interface ReplacePropertyAction extends BaseAction {
	type: typeof Actions.ReplaceProperty;
	property: string;
	value: Key;
}

export interface ReplaceSelfAction extends BaseAction {
	type: typeof Actions.ReplaceSelf;
	// biome-ignore lint/suspicious/noExplicitAny: Value can be any AST node type
	value: any;
}

export enum AddArrayElementPosition {
	Start = "start",
	End = "end",
}

export interface AddArrayElementAction extends BaseAction {
	type: typeof Actions.AddArrayElement;
	// biome-ignore lint/suspicious/noExplicitAny: Element can be any AST node type
	element: any;
	position?: AddArrayElementPosition;
}

export type Action =
	| DeleteAction
	| ReplacePropertyAction
	| AddArrayElementAction
	| ReplaceSelfAction;

export interface Filter {
	selector?: FilterObject;
	actions: Record<number, Action[]> & {
		program?: Action[];
	};
}

export interface Mod {
	name: string;
	id: string;
	filters: Filter[] | Filter[][];
}
