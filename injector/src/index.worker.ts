import { createHooks } from "./hook";
import type { LoadingState } from "./hook";

export const WORKER_ENTRY_FILE_URL = import.meta.url;

export type WorkerMessage = { type: "message"; msg: string; } | { type: "state"; state: LoadingState; } | { type: "url"; url: string; };

onmessage = async (e) => {
	postMessage({ msg: "Worker started" });
	const js = await createHooks({
		// ./html5game/RetroBowl.js
		url: e.data.url + "html5game/RetroBowl.js",
		logFn: (msg) => {
			postMessage({ type: "message", msg });
		},
		loadingStateCallback: (state) => {
			postMessage({ type: "state", state });
		}
	});

	const blob = new Blob([js], {
		type: "application/javascript",
	});

	const url = URL.createObjectURL(blob);

	postMessage({ type: "url", url });
}