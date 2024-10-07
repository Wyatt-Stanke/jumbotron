import { createHooks } from "./hook";

const log = document.getElementById("log");

// Create a script element before the window.onload event
// with the code that's returned from the createHooks function
const script = document.createElement("script");
const js = await createHooks({
	url: "html5game/RetroBowl.js",
	logFn: (msg) => {
		// biome-ignore lint/style/useTemplate: <explanation>
		log.innerHTML += msg + "</br>";
	},
});
// Create a blob URL from the code
const blob = new Blob([js], {
	type: "application/javascript",
});
const url = URL.createObjectURL(blob);
// Set the script element's src to the blob URL
script.src = url;
// log.style.display = "none";
// Append the script element to the document
document.body.appendChild(script);
