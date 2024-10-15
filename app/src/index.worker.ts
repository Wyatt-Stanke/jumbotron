import { createHooks } from "../../injector/src/hook";
import type { LoadingState } from "../../injector/src/hook";

export type WorkerMessage =
	| { type: "message"; msg: string }
	| { type: "state"; state: LoadingState }
	| { type: "url"; url: string };

addEventListener("message", async (e) => {
	postMessage({ msg: "Worker started" });
	const js = await createHooks({
		url: `${e.data.url}html5game/RetroBowl.js`,
		logFn: (msg) => {
			postMessage({ type: "message", msg });
		},
		loadingStateCallback: (state) => {
			postMessage({ type: "state", state });
		},
	});

	const blob = new Blob([js], {
		type: "application/javascript",
	});

	const url = URL.createObjectURL(blob);

	postMessage({ type: "url", url });
});
