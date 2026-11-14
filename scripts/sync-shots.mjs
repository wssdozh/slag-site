// Screenshots come from the app repository instead of being copied into this one by hand:
// `npm run shots` refreshes them, and a stale picture cannot silently become a lie.
// The feed and the phone are the README pair (2× and current); the modal shots are what
// e2e/visual_comparison.spec.ts writes into test-results.
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const APP_REPO = process.env.SLAG_APP_REPO || path.resolve(process.cwd(), '..', 'SLAG v2');
const OUT = path.join(process.cwd(), 'public', 'shots');

// the name on the site -> the file in the app repository
const SHOTS = [
  ['feed.png', 'docs/screenshots/readme/desktop-feed.png'],
  ['phone.png', 'docs/screenshots/readme/android-tasks.png'],
  ['editor.png', 'screenshots/editor-task-clean.png'],
  ['search.png', 'test-results/screenshots/after_modal_search.png'],
  ['triage.png', 'test-results/screenshots/after_modal_triage.png'],
  ['folder.png', 'test-results/screenshots/after_folder_info_desktop.png'],
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
