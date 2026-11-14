// Pull the three facts the site must never invent: the current version with its real download
// links, the release notes, and the plan prices. Every source is optional — when GitHub or the
// relay is unreachable the committed snapshot stays in place and the build still succeeds.
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const REPO = 'wssdozh/slag-v2';
const RELAY = process.env.SLAG_RELAY_URL || 'http://152.53.199.71:8320';
const DATA = path.join(process.cwd(), 'src', 'data');

const MANIFEST = `https://github.com/${REPO}/releases/latest/download/latest.json`;
const RELEASES = `https://api.github.com/repos/${REPO}/releases?per_page=12`;
const RELEASE_PAGE = `https://github.com/${REPO}/releases/latest`;

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(path.join(DATA, file), 'utf8'));
  } catch {
    return fallback;
  }
};

const writeJson = async (file, value) => {
  await writeFile(path.join(DATA, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const getJson = async (url, headers = {}) => {
  const response = await fetch(url, {
    headers: { 'user-agent': 'slag-site-build', accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.json();
};

// The manifest is what the app itself reads, so the site cannot drift from the updater.
async function updateLatest() {
  const manifest = await getJson(MANIFEST);
  const platforms = manifest.platforms ?? {};
  const windows = platforms['windows-x86_64'] ?? {};
  const android = platforms['android-aarch64'] ?? {};
  const pick = (...assets) => assets.find((asset) => asset && typeof asset.url === 'string')?.url ?? RELEASE_PAGE;

  const latest = {
    version: manifest.version,
    pubDate: manifest.pub_date ?? null,
    notes: manifest.notes ?? null,
    downloads: {
      windows: pick(windows.installer, windows.portable),
      android: pick(android.apk, android.installer),
      linux: RELEASE_PAGE,
    },
  };
  await writeJson('latest.json', latest);
  console.log(`latest: v${latest.version}`);
}

async function updateReleases() {
  const token = process.env.GITHUB_TOKEN;
  const releases = await getJson(RELEASES, token ? { authorization: `Bearer ${token}` } : {});
  const mapped = releases
    .filter((release) => !release.draft)
    .map((release) => ({
      version: String(release.tag_name ?? '').replace(/^v/, ''),
      date: (release.published_at ?? '').slice(0, 10),
      url: release.html_url,
      notes: String(release.body ?? '').trim().slice(0, 4000),
    }))
    .filter((release) => release.version);
  if (mapped.length === 0) throw new Error('no releases returned');
  await writeJson('releases.json', mapped);
  console.log(`releases: ${mapped.length}`);
}

// One source for the money: prices live next to the plan limits in the relay.
async function updatePlans() {
  const body = await getJson(`${RELAY}/api/plans`);
  const plans = Array.isArray(body?.plans) ? body.plans : [];
  if (plans.length !== 3) throw new Error(`unexpected plans payload (${plans.length})`);

  const previous = await readJson('plans.json', { plans: [] });
  const merged = plans.map((plan) => {
    const known = previous.plans.find((entry) => entry.id === plan.id) ?? {};
    return {
      id: plan.id,
      label: plan.label ?? known.label ?? plan.id,
      priceRub: Number(plan.priceRub ?? plan.price_rub ?? known.priceRub ?? 0),
      devices: Number(plan.devices ?? known.devices ?? 0),
      cacheMb: Number(plan.cacheMb ?? plan.cache_mb ?? known.cacheMb ?? 0),
      summary: known.summary ?? '',
      features: known.features ?? [],
    };
  });
  await writeJson('plans.json', { updated: new Date().toISOString().slice(0, 10), source: `${RELAY}/api/plans`, plans: merged });
  console.log(`plans: ${merged.map((plan) => `${plan.id}=${plan.priceRub}`).join(' ')}`);
}

const steps = [
  ['latest', updateLatest],
  ['releases', updateReleases],
  ['plans', updatePlans],
];

for (const [name, step] of steps) {
  try {
    await step();
  } catch (error) {
    const hasSnapshot = existsSync(path.join(DATA, `${name === 'latest' ? 'latest' : name}.json`));
    console.warn(`${name}: ${error.message}${hasSnapshot ? ' — keeping the committed snapshot' : ''}`);
  }
}
