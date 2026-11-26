import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

export async function saveLineage(content: string, extension: string, format: string): Promise<void> {
  const path = await save({
    defaultPath: `lineage.${extension}`,
    filters: [{ name: format.toUpperCase(), extensions: [extension] }],
  });
  if (path) await writeTextFile(path, content);
}
