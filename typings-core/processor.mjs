import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputFilePath = join(__dirname, 'out', 'RetroBowl.d.ts');
const outputFilePath = join(__dirname, 'RetroBowl-raw.d.ts');

async function processFiles() {
    try {
        let rawData = await fs.readFile(inputFilePath, 'utf8');

        const functionNames = rawData.matchAll(/declare function ([^(]+)/g).map((match) => match[1]);


        
        await fs.writeFile(outputFilePath, data, 'utf8');
        console.log('File has been written successfully.');
    } catch (err) {
        console.error('Error processing the files:', err);
    }
}

processFiles();