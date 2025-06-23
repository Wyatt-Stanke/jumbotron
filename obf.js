import pkg from "javascript-obfuscator";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const { obfuscate } = pkg;

const config = {
	compact: false,
	controlFlowFlattening: false,
	controlFlowFlatteningThreshold: 0.75,
	deadCodeInjection: false,
	deadCodeInjectionThreshold: 0.4,
	debugProtection: false,
	debugProtectionInterval: 0,
	disableConsoleOutput: false,
	domainLock: [],
	domainLockRedirectUrl: "about:blank",
	forceTransformStrings: [],
	identifierNamesCache: null,
	identifierNamesGenerator: "mangled",
	identifiersDictionary: [],
	identifiersPrefix: "",
	ignoreImports: false,
	inputFileName: "",
	log: false,
	numbersToExpressions: false,
	optionsPreset: "default",
	renameGlobals: true,
	renameProperties: true,
	renamePropertiesMode: "unsafe",
	reservedNames: [],
	reservedStrings: [],
	seed: 130,
	selfDefending: false,
	simplify: false,
	sourceMap: false,
	sourceMapBaseUrl: "",
	sourceMapFileName: "",
	sourceMapMode: "separate",
	sourceMapSourcesMode: "sources-content",
	splitStrings: false,
	splitStringsChunkLength: 10,
	stringArray: false,
	stringArrayCallsTransform: false,
	stringArrayCallsTransformThreshold: 0.5,
	stringArrayEncoding: [],
	stringArrayIndexesType: ["hexadecimal-number"],
	stringArrayIndexShift: false,
	stringArrayRotate: false,
	stringArrayShuffle: false,
	stringArrayWrappersCount: 1,
	stringArrayWrappersChainedCalls: true,
	stringArrayWrappersParametersMaxCount: 2,
	stringArrayWrappersType: "variable",
	stringArrayThreshold: 0.75,
	target: "browser",
	transformObjectKeys: false,
	unicodeEscapeSequence: false,
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

if (args.length !== 1) {
	console.error("Usage: node obf.js <inputFile>");
	process.exit(1);
}

const inputFile = args[0];
const inputFilePath = path.resolve(__dirname, inputFile);

fs.readFile(inputFilePath, "utf8", (err, data) => {
	if (err) {
		console.error(`Error reading file: ${err.message}`);
		process.exit(1);
	}

	console.log(`Obfuscating ${inputFile}...`);
	const obfuscatedCode = obfuscate(data, config).getObfuscatedCode();
	console.log("Obfuscation complete");
	const outputFilePath = path.join(
		__dirname,
		`${path.basename(inputFile, path.extname(inputFile))}_obf.js`,
	);

	fs.writeFile(outputFilePath, obfuscatedCode, (err) => {
		if (err) {
			console.error(`Error writing file: ${err.message}`);
			process.exit(1);
		}

		console.log(`Obfuscated file written to ${outputFilePath}`);
	});
});
