import { defineConfig, type Plugin } from "vite";
import {$} from "execa";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const copyPlugin = (): Plugin => {
  return {
			name: "copy-static-files",
			buildStart() {
        console.log("Copying static files");
				$({ shell: true })`cp -r ../data/raw/* ./public`;
        console.log("Copying overwrite files");
        $({ shell: true })`cp -r ../data/overwrite/* ./public`;
        console.log("Copying index.html");
        $({ shell: true })`cp public/index.html ./index.html`;
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
});
