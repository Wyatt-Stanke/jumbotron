import { createHooks } from "./hook";

export const WORKER_ENTRY_FILE_URL = import.meta.url;

onmessage = async (e) => {
	postMessage({ msg: "Worker started" });
	const js = await createHooks({
		// ./html5game/RetroBowl.js
		url: e.data.url + "html5game/RetroBowl.js",
		logFn: (msg) => {
			postMessage({ msg });
		},
	});

	const blob = new Blob([js], {
		type: "application/javascript",
	});

	const url = URL.createObjectURL(blob);

	postMessage({ url });
}