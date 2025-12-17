export const Contains = "Contains" as const;
export const TagSymbol = Symbol("Tag");
export const Actions = {
	Delete: "Actions_Delete" as const,
	ReplaceProperty: "Actions_ReplaceProperty" as const,
	AddArrayElement: "Actions_AddArrayElement" as const,
	ReplaceSelf: "Actions_ReplaceSelf" as const,
};

export const SubstitutionPrimitives = {
	UniqueSafeString: "Primitives_UniqueSafeString" as const,
};

export const ObjectPrimitives = {
	ParseJSExpression: "Primitives_ParseJSExpression" as const,
};

export class Tag {
	public inner: number | string;

	constructor(inner: number | string) {
		this.inner = inner;
	}
}

export function tag(inner: number | string): Tag {
	return new Tag(inner);
}
