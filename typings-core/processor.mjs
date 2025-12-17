import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputFilePath = join(__dirname, "out", "RetroBowl.d.ts");
const outputFilePath = join(__dirname, "RetroBowl-raw.d.ts");

async function processFiles() {
	try {
		const rawData = await fs.readFile(inputFilePath, "utf8");

		const data = rawData.replace(
			/declare (function|const|let|var|namespace|class)/g,
			"export $1",
		);

		await fs.writeFile(outputFilePath, data, "utf8");
		console.log("Raw files have been processed successfully.");

		let computedTypes = "";
		console.log("Generating function names...");
		const functionNames =
			data
				.match(/export function (\w+)/g)
				?.map((line) => line.replace("export function ", "")) || [];
		computedTypes += `export type FunctionNames = ${functionNames.map((name) => `"${name}"`).join(" | ")};\n\n`;

		await fs.writeFile(
			join(__dirname, "RetroBowl-precomputed.d.ts"),
			computedTypes,
			"utf8",
		);
	} catch (err) {
		console.error("Error processing the files:", err);
	}
}

processFiles();
