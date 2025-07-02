import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modsDir = path.join(__dirname, '../mods');
const modIndexPath = path.join(modsDir, '../mods/modindex.json');

try {
  // Check if mods directory exists
  try {
    await fs.access(modsDir);
  } catch {
    console.error('Mods directory not found:', modsDir);
    process.exit(1);
  }

  // Read all files in the mods directory
  const files = await fs.readdir(modsDir);
  
  // Filter for mod files (exclude modindex.json and directories)
  const modFiles = [];
  for (const file of files) {
    if (file === 'modindex.json') continue;
    
    const filePath = path.join(modsDir, file);
    const stat = await fs.stat(filePath);
    if (stat.isFile()) {
      modFiles.push(file);
    }
  }

  // Sort alphabetically for consistency
  modFiles.sort();

  // Write the modindex.json file
  await fs.writeFile(modIndexPath, JSON.stringify(modFiles, null, 2));
  
  console.log(`Generated modindex.json with ${modFiles.length} mod files`);
  console.log('Mod files:', modFiles);

} catch (error) {
  console.error('Error generating modindex.json:', error.message);
  process.exit(1);
}

