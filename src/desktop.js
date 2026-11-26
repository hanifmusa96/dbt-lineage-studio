import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

export async function saveLineage(content, extension, format) {
  const path = await save({
    defaultPath: `lineage.${extension}`,
    filters: [{ name: format.toUpperCase(), extensions: [extension] }],
  });
  if (path) await writeTextFile(path, content);
}
