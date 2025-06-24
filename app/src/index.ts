import type { WorkerMessage } from "./index.worker.ts";

const loaderDisplay = document.getElementById("loader-display");
const log = document.getElementById("log");

// Create a script element before the window.onload event
// with the code that's returned from the createHooks function
const script = document.createElement("script");

// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
const addMsg = (msg: string) => { if (log) { log.innerHTML += `${msg}</br>`; } };

const worker = new Worker(new URL("./index.worker.ts", import.meta.url), { type: "module" });

worker.postMessage({ url: window.location.href });

const barLength = 50;

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
				loaderDisplay.innerHTML += `<div id="mod-${id}">${queued} ${name} (${id}) -- <span style="float:right;margin-right:10px;"><span id="mod-${id}-bar">[${"&nbsp;".repeat(barLength)}]</span> <span id="mod-${id}-counter">0/${filters.length}</span></span></div>`;
			}
		} else if (state.type === "modStarting") {
			document.getElementById(`mod-${state.modId}`).innerHTML.replace(
				queued,
				started
			);
		} else if (state.type === "filterApplied") {
			const { modId, filterIndex } = state;
			const counter = document.getElementById(`mod-${modId}-counter`);
			const bar = document.getElementById(`mod-${modId}-bar`);
			if (!counter || !bar) {
				return;
			}
			const filterCount = Number.parseInt(counter.innerHTML.split("/")[1]);
			const progress = Math.floor(((filterIndex + 1) / filterCount) * barLength);
			counter.innerHTML = `${filterIndex + 1}/${filterCount}`;
			bar.innerHTML = `[${"=".repeat(progress)}${"&nbsp;".repeat(barLength - progress)}]`;
		} else if (state.type === "modFinished") {
			const { modId, modName } = state;
			document.getElementById(`mod-${modId}`).innerHTML.replace(
				started,
				applied
			);
		} else if (state.type === "filterFailed") {
			const { modId, filterIndex } = state;
			const filterElement = document.getElementById(`filter-${modId}-${filterIndex}`);
			if (filterElement) {
				filterElement.innerHTML = filterElement.innerHTML.replace(
					started,
					failed
				);
			}
		}
	}
};
