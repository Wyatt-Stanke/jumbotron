const exampleTemplate = ({ flag1 }) => [
	"a",
	"b",
	`${flag1 ? "return a + b;" : ""}`,
];

// biome-ignore lint/suspicious/noExplicitAny: Needed to make a generic class
class FunctionGenerator<Flags extends { [key: string]: any }> {
	constructor(
		public template: (args: Flags) => string[],
		public flags: Flags,
	) {}

	generate() {
		return new Function(...this.template(this.flags));
	}
}

const fg = new FunctionGenerator(exampleTemplate, { flag1: true });
