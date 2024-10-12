import Worker from "./index.worker.ts"

const log = document.getElementById("log");

// Create a script element before the window.onload event
// with the code that's returned from the createHooks function
const script = document.createElement("script");

// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
const addMsg = msg => log.innerHTML += `${msg}</br>`;

const worker = Worker();

worker.postMessage({ url: window.location.href });

worker.onmessage = (e) => {
	console.log(e.data);
	if (e.data.msg) {
		addMsg(e.data.msg);
	} else if (e.data.url) {
		script.src = e.data.url;
		document.body.appendChild(script);
	}
}