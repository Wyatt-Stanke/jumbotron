import * as esbuild from "esbuild";
import findCacheDir from "find-cache-dir";
import fs from "fs";
import path from "path";

function inlineWorkerPlugin() {
	return {
		name: "esbuild-plugin-inline-worker",

		setup(build) {
			build.onLoad(
				{ filter: /\.worker\.(js|jsx|ts|tsx)$/ },
				async ({ path: workerPath }) => {
					// let workerCode = await fs.promises.readFile(workerPath, {
					//   encoding: 'utf-8',
					// });

					const workerCode =
						`globalThis.process={env:{},platform:"browser"};` +
						(await buildWorker(workerPath));
					return {
						contents: `import inlineWorker from '__inline-worker'
export default function Worker() {
  return inlineWorker(${JSON.stringify(workerCode)});
}
`,
						loader: "js",
					};
				},
			);

			const inlineWorkerFunctionCode = `
export default function inlineWorker(scriptText) {
  let blob = new Blob([scriptText], {type: 'text/javascript'});
  let url = URL.createObjectURL(blob);
  let worker = new Worker(url, { type: 'module' });
  URL.revokeObjectURL(url);
  return worker;
}
`;

			build.onResolve({ filter: /^__inline-worker$/ }, ({ path }) => {
				return { path, namespace: "inline-worker" };
			});
			build.onLoad({ filter: /.*/, namespace: "inline-worker" }, () => {
				return { contents: inlineWorkerFunctionCode, loader: "js" };
			});
		},
	};
}

const cacheDir = findCacheDir({
	name: "esbuild-plugin-inline-worker",
	create: true,
});

async function buildWorker(workerPath) {
	const scriptNameParts = path.basename(workerPath).split(".");
	scriptNameParts.pop();
	scriptNameParts.push("js");
	const scriptName = scriptNameParts.join(".");
	const bundlePath = path.resolve(cacheDir, scriptName);

	await esbuild.build({
		entryPoints: [workerPath],
		bundle: true,
		minify: true,
		outfile: bundlePath,
		target: "es2022",
		format: "esm",
	});

	return fs.promises.readFile(bundlePath, { encoding: "utf-8" });
}
esbuild.build({
	entryPoints: ["src/hook.ts"],
	bundle: true,
	minify: true,
	metafile: true,
	sourcemap: true,
	target: "es2022",
	treeShaking: true,
	format: "esm",
	outfile: "out/index.js",
	plugins: [inlineWorkerPlugin()],
});
