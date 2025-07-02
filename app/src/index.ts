import type { WorkerMessage } from "./index.worker.ts";

const loaderDisplay = document.getElementById("loader-display");
const log = document.getElementById("log");

// Create a script element before the window.onload event
// with the code that's returned from the createHooks function
const script = document.createElement("script");

// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
const addMsg = (msg: string) => {
	if (log) {
		log.innerHTML += `${msg}</br>`;
	}
};

// Load all available mods
const modIndex = (await fetch("./mods/modindex.json").then((res) =>
	res.json(),
)) as string[];
const allMods = await Promise.all(
	modIndex.map((mod) => {
		return fetch(`./mods/${mod}`)
			.then((res) =>
				Promise.all([res.json(), res.headers.get("Content-Length")]),
			)
			.then(([modData, bytes]) => {
				return { ...modData, size: bytes };
			});
	}),
);

// Create mod selection panel
const createModSelectionPanel = (): Promise<any[]> => {
	return new Promise((resolve) => {
		// Create overlay
		const overlay = document.createElement("div");
		overlay.className = "mod-selection-overlay";

		// Create panel container
		const panel = document.createElement("div");
		panel.className = "mod-selection-panel";

		// Create title
		const title = document.createElement("h2");
		title.textContent = "Select Mods to Load";
		title.style.cssText = "margin-top: 0; color: #333; text-align: center;";
		panel.appendChild(title);

		// Create mod list
		const modList = document.createElement("div");
		const checkboxes: HTMLInputElement[] = [];

		allMods.forEach((mod, index) => {
			const modItem = document.createElement("div");
			modItem.className = "mod-item";
			modItem.style.cssText = "display: flex; align-items: center;";

			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.id = `mod-${index}`;
			checkbox.checked = true; // Default to all mods selected
			checkbox.style.marginRight = "10px";
			checkboxes.push(checkbox);

			const label = document.createElement("label");
			label.htmlFor = checkbox.id;
			label.style.cssText = "cursor: pointer; color: #333;";
			label.innerHTML = `<strong>${mod.name}</strong> (${mod.id}) - <small style="color: #666;">${mod.size} bytes</small>`;

			modItem.appendChild(checkbox);
			modItem.appendChild(label);
			modList.appendChild(modItem);
		});

		panel.appendChild(modList);

		// Create buttons
		const buttonContainer = document.createElement("div");
		buttonContainer.style.cssText = "margin-top: 20px;";

		const selectAllBtn = document.createElement("button");
		selectAllBtn.textContent = "Select All";
		selectAllBtn.className = "mod-button primary";
		selectAllBtn.onclick = () =>
			checkboxes.forEach((cb) => (cb.checked = true));

		const selectNoneBtn = document.createElement("button");
		selectNoneBtn.textContent = "Select None";
		selectNoneBtn.className = "mod-button secondary";
		selectNoneBtn.onclick = () =>
			checkboxes.forEach((cb) => (cb.checked = false));

		const startBtn = document.createElement("button");
		startBtn.textContent = "Start Game";
		startBtn.className = "mod-button success";
		startBtn.onclick = () => {
			const selectedMods = allMods.filter(
				(_, index) => checkboxes[index].checked,
			);
			document.body.removeChild(overlay);
			resolve(selectedMods);
		};

		buttonContainer.appendChild(selectAllBtn);
		buttonContainer.appendChild(selectNoneBtn);
		buttonContainer.appendChild(startBtn);
		panel.appendChild(buttonContainer);

		// Add overlay and panel to document
		overlay.appendChild(panel);
		document.body.appendChild(overlay);
	});
};

// Show mod selection panel and wait for user selection
const selectedMods = await createModSelectionPanel();

// Log selected mods
selectedMods.forEach((mod) => {
	addMsg(`Selected mod: ${mod.name} (${mod.id}) - ${mod.size} bytes`);
});

document.getElementById("canvas")!.style.display = "block";
const worker = new Worker(new URL("./index.worker.ts", import.meta.url), {
	type: "module",
});

worker.postMessage({ type: "mods", mods: selectedMods });
worker.postMessage({ type: "url", url: window.location.href });

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
				if (loaderDisplay) {
					loaderDisplay.innerHTML += `<div id="mod-${id}">${queued} ${name} (${id}) -- <span style="float:right;margin-right:10px;"><span id="mod-${id}-bar">[${"&nbsp;".repeat(barLength)}]</span> <span id="mod-${id}-counter">0/${filters.length}</span></span></div>`;
				}
			}
		} else if (state.type === "modStarting") {
			const modElement = document.getElementById(`mod-${state.modId}`);
			if (modElement) {
				modElement.innerHTML = modElement.innerHTML.replace(queued, started);
			}
		} else if (state.type === "filterApplied") {
			const { modId, filterIndex } = state;
			const counter = document.getElementById(`mod-${modId}-counter`);
			const bar = document.getElementById(`mod-${modId}-bar`);
			if (!counter || !bar) {
				return;
			}
			const filterCount = Number.parseInt(counter.innerHTML.split("/")[1]);
			const progress = Math.floor(
				((filterIndex + 1) / filterCount) * barLength,
			);
			counter.innerHTML = `${filterIndex + 1}/${filterCount}`;
			bar.innerHTML = `[${"=".repeat(progress)}${"&nbsp;".repeat(barLength - progress)}]`;
		} else if (state.type === "modFinished") {
			const { modId } = state;
			const modElement = document.getElementById(`mod-${modId}`);
			if (modElement) {
				modElement.innerHTML = modElement.innerHTML.replace(started, applied);
			}
		} else if (state.type === "filterFailed") {
			const { modId, filterIndex } = state;
			const filterElement = document.getElementById(
				`filter-${modId}-${filterIndex}`,
			);
			if (filterElement) {
				filterElement.innerHTML = filterElement.innerHTML.replace(
					started,
					failed,
				);
			}
		}
	}
};
