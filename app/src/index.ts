import type { WorkerMessage } from "./index.worker.ts";

const loaderDisplay = document.getElementById("loader-display");
const log = document.getElementById("log");

// Create a script element before the window.onload event
// with the code that's returned from the createHooks function
const script = document.createElement("script");

// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
const addMsg = (msg) => (log.innerHTML += `${msg}</br>`);

const worker = new Worker(new URL("./index.worker.ts", import.meta.url), { type: "module" });

worker.postMessage({ url: window.location.href });

worker.onmessage = (e: { data: WorkerMessage }) => {
	console.log(e.data);
	if (e.data.type === "message") {
		addMsg(e.data.msg);
	} else if (e.data.type === "url") {
		script.src = e.data.url;
		document.body.appendChild(script);
	} else if (e.data.type === "state") {
		const queued = `<span style="color: gray;">[queued]</span>`;
		const started = `<span style="color: blue;">[started]</span>`;
		const applied = `<span style="color: green;">[applied]</span>`;
		const failed = `<span style="color: red;">[failed]</span>`;
		const state = e.data.state;

		if (state.type === "started") {
			for (const mod of state.mods) {
				const { filters, id, name } = mod;
				loaderDisplay.innerHTML += `<div id="mod-${id}">${queued} ${name} (${id})</div>`;
				for (const [index, filter] of filters.entries()) {
					loaderDisplay.innerHTML += `<div id="filter-${id}-${index}">${queued} ${filter[0]}</div>`;
				}
				loaderDisplay.innerHTML += "<br>";
			}
		} else if (state.type === "modStarting") {
			const { modId, modName } = state;
			document.getElementById(`mod-${state.modId}`).innerHTML =
				`${started} ${modName} (${modId})`;
		} else if (state.type === "filterApplied") {
			const { modId, filterIndex } = state;
			document.getElementById(`filter-${modId}-${filterIndex}`).innerHTML =
				applied;
		} else if (state.type === "modFinished") {
			const { modId, modName } = state;
			document.getElementById(`mod-${modId}`).innerHTML =
				`${applied} ${modName} (${modId})`;
		} else if (state.type === "filterFailed") {
			const { modId, filterIndex } = state;
			document.getElementById(`filter-${modId}-${filterIndex}`).innerHTML =
				failed;
		}
	}
};
