import type { LoadingState } from "@jumbotron/injector-core";
import { createHooks } from "@jumbotron/injector-core";
import { TagSymbol } from "@jumbotron/injector-symbols";

export type WorkerMessage =
	| { type: "message"; msg: string }
	| { type: "state"; state: LoadingState }
	| { type: "url"; url: string };

let mods: unknown[];

addEventListener("message", async (e) => {
	if (e.data.type === "mods") {
		// For each mod, recursively re-add the TagSymbol if a "_tag" property was found.
		// biome-ignore lint/suspicious/noExplicitAny: Mod structure is dynamic and requires any for recursive traversal
		mods = e.data.mods.map((mod: any) => {
			// biome-ignore lint/suspicious/noExplicitAny: Recursive function needs any to handle arbitrary nested structures
			const restoreTagSymbol = (obj: any): any => {
				if (Array.isArray(obj)) {
					return obj.map(restoreTagSymbol);
				}
				if (obj && typeof obj === "object") {
					if (Object.hasOwn(obj, "_tag")) {
						obj[TagSymbol] = { inner: obj._tag };
						delete obj._tag;
					}
					for (const key in obj) {
						obj[key] = restoreTagSymbol(obj[key]);
					}
				}
				return obj;
			};
			return restoreTagSymbol(mod);
		});
		postMessage({ msg: "Mods received with tag restored" });
		return;
	}
	if (e.data.type === "url") {
		postMessage({ msg: "Worker started" });
		const js = await createHooks({
			url: `${e.data.url}html5game/RetroBowl.js`,
			logFn: (msg) => {
				postMessage({ type: "message", msg });
			},
			loadingStateCallback: (state) => {
				postMessage({ type: "state", state });
			},
			mods,
		});

		const blob = new Blob([js], {
			type: "application/javascript",
		});

		const url = URL.createObjectURL(blob);

		postMessage({ type: "url", url });
	}
});
