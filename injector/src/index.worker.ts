import { createHooks } from "./hook";

export const WORKER_ENTRY_FILE_URL = import.meta.url;

const js = await createHooks({
	// ./html5game/RetroBowl.js
	url: new URL("./html5game/RetroBowl.js", import.meta.url.replace("blob:","")).href,
	logFn: (msg) => {
		postMessage({ msg });
	},
});

const blob = new Blob([js], {
	type: "application/javascript",
});

const url = URL.createObjectURL(blob);
postMessage({ url });