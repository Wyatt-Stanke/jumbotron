export const Contains = Symbol("Contains");
export const TagSymbol = Symbol("Tag");
export const Actions = {
	Delete: "Actions.Delete" as const,
	ReplaceProperty: "Actions.ReplaceProperty" as const,
	AddArrayElement: "Actions.AddArrayElement" as const,
	ReplaceSelf: "Actions.ReplaceSelf" as const,
};
