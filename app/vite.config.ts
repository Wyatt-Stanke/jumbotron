import { promises as fs } from "node:fs";
import { $ } from "execa";
import { defineConfig, type Plugin } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const copyPlugin = (): Plugin => {
	return {
		name: "copy-static-files",
		async buildStart() {
			await fs.mkdir("./public", { recursive: true });
			console.log("Copying static files");
			await $({ shell: true })`cp -r ../data/raw/* ./public`;
			console.log("Copying overwrite files");
			await $({ shell: true })`cp -r ../data/overwrite/* ./public`;
			console.log("Copying index.html");
			await $({ shell: true })`mv public/index.html ./index.html`;
			console.log("Generating modindex.json");
			await $({ shell: true })`node ./scripts/generate-modindex.js`;
			console.log("Copying mods");
			await $({ shell: true })`cp -r ./mods ./public`;

			if (process.env.NODE_ENV === "production") {
				await fs.mkdir("./dist", { recursive: true });
				console.log("Copying static files to dist");
				await $({ shell: true })`cp -r ../data/raw/* ./dist`;
				console.log("Copying overwrite files to dist");
				await $({ shell: true })`cp -r ../data/overwrite/* ./dist`;
				console.log("Copying index.html to dist");
				await $({ shell: true })`cp index.html ./dist/index.html`;
				console.log("Copying mods to dist");
				await $({ shell: true })`cp -r ./mods ./dist`;
				console.log("Copying modindex.json to dist");
				await $({
					shell: true,
				})`cp ./public/mods/modindex.json ./dist/mods/modindex.json`;
			}
		},
	};
};

export default defineConfig({
	plugins: [
		copyPlugin(),
		nodePolyfills({
			include: [],
			globals: {
				process: true,
			},
		}),
	],
	build: {
		target: "esnext",
	},
});
