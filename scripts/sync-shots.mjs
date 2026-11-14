// Screenshots are taken from the app repository instead of being copied into this one by hand:
// `npm run shots` refreshes them, and a stale picture cannot silently become a lie.
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP_REPO = process.env.SLAG_APP_REPO || path.resolve(process.cwd(), '..', 'SLAG v2');
const OUT = path.join(process.cwd(), 'public', 'shots');

// the name on the site -> the file in the app repository
const SHOTS = [
  ['editor.png', 'screenshots/editor-task-clean.png'],
  ['search.png', 'docs/comparison/after/after_modal_search.png'],
  ['triage.png', 'docs/comparison/after/after_modal_triage.png'],
  ['folder.png', 'docs/comparison/after/after_folder_info_desktop.png'],
  ['mobile.png', 'docs/comparison/after/after_mobile_tasks.png'],
  ['media.png', 'screenshots/multimedia-search.png'],
];

await mkdir(OUT, { recursive: true });

let copied = 0;
for (const [target, source] of SHOTS) {
  try {
    await copyFile(path.join(APP_REPO, source), path.join(OUT, target));
    copied += 1;
  } catch (error) {
    console.warn(`skip ${target}: ${error.code ?? error.message}`);
  }
}

console.log(`shots: ${copied}/${SHOTS.length} из ${APP_REPO}`);
