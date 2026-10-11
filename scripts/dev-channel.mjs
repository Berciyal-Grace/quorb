// Dev overlays are generated in the build workspace only; stable manifests stay intact.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { compareVersions } from './bump.mjs';
import { isValidSha, isValidUpdaterPubkey } from './release-check.mjs';

const REPO = 'egdev6/quorb';
const FEED_TAG = 'dev-latest';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export function devVersion(number) {
  if (!/^[1-9]\d*$/.test(String(number))) throw new Error('Expected a positive workflow build number');
  const n = Number(number);
  if (!Number.isSafeInteger(n) || n >= 256 * 65536) throw new Error('Dev build number exceeds Windows version limits');
  return `0.${Math.floor(n / 65536)}.${n % 65536}`;
}

export function prepareDev({ cwd = process.cwd(), buildNumber, sourceSha }) {
  const version = devVersion(buildNumber);
  if (!isValidSha(sourceSha)) throw new Error('Expected a full source SHA');
  const base = readJson(path.join(cwd, 'src-tauri/tauri.conf.json'));
  if (!isValidUpdaterPubkey(base.plugins?.updater?.pubkey)) throw new Error('Updater signing public key is missing or invalid');
  const overlay = readJson(path.join(cwd, 'src-tauri/tauri.dev.conf.json'));
  if (overlay.identifier !== 'es.egdev.quorb.dev' || overlay.productName !== 'Quorb Dev' || overlay.mainBinaryName !== 'quorb-dev') throw new Error('Invalid Dev identity');
  const config = {
    ...overlay, version,
    app: { windows: base.app.windows.map(win => ({ ...win, title: 'Quorb Dev' })) },
    plugins: { updater: { ...base.plugins.updater, ...overlay.plugins.updater } },
  };
  fs.mkdirSync(path.join(cwd, '.dev-build'), { recursive: true });
  writeJson(path.join(cwd, '.dev-build/tauri.dev.conf.json'), config);
  return config;
}

export function validateDevManifest(manifest, { version, tag }) {
  if (!/^dev-[1-9]\d*-[1-9]\d*$/.test(tag)) throw new Error('Not an immutable Dev tag');
  if (manifest.version !== version) throw new Error('Built updater version differs from expected Dev version');
  const platforms = Object.entries(manifest.platforms ?? {});
  if (!manifest.platforms?.['windows-x86_64'] || !platforms.length) throw new Error('Missing Windows updater asset');
  for (const [platform, asset] of platforms) {
    if (!/^windows-x86_64(?:-nsis|-msi)?$/.test(platform)) throw new Error('Unexpected updater platform');
    if (typeof asset.signature !== 'string' || !asset.signature.trim()) throw new Error('Missing updater signature');
    const url = new URL(asset.url);
    if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(`/${REPO}/releases/download/${tag}/`) || !/\.(exe|msi)$/.test(url.pathname)) throw new Error('Updater asset is outside this immutable Dev build');
  }
}

export function shouldAdvanceFeed(version, previous) {
  for (const v of [version, previous].filter(v => v !== null)) {
    if (!/^0\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v)) throw new Error('Invalid Dev feed version');
    const [, minor, patch] = v.split('.').map(Number);
    if (minor > 255 || patch > 65535) throw new Error('Invalid Windows feed version');
  }
  return previous === null || compareVersions(version, previous) > 0;
}

const runGh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// Called only by the serialized feed job. Published installers have immutable URLs;
// replacing latest.json never replaces binaries used by an in-flight download.
export function publishFeed({ version, tag, sourceSha, run = runGh }) {
  const gh = run;
  shouldAdvanceFeed(version, null);
  if (!isValidSha(sourceSha)) throw new Error('Expected a full source SHA');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quorb-dev-feed-'));
  try {
    gh(['release', 'download', tag, '--repo', REPO, '--pattern', 'latest.json', '--dir', dir]);
    const file = path.join(dir, 'latest.json');
    validateDevManifest(readJson(file), { version, tag });
    let existing;
    try { existing = JSON.parse(gh(['api', `repos/${REPO}/releases/tags/${FEED_TAG}`])); }
    catch (error) {
      if (!/HTTP 404/.test(String(error.stderr))) throw error;
    }
    if (existing) {
      if (!existing.prerelease) throw new Error('Refusing to modify a non-prerelease feed');
      const hasManifest = existing.assets.some(asset => asset.name === 'latest.json');
      if (!hasManifest && !existing.draft) throw new Error('Published Dev feed has no manifest; inspect before repairing');
      if (hasManifest) {
        const oldDir = path.join(dir, 'previous'); fs.mkdirSync(oldDir);
        gh(['release', 'download', FEED_TAG, '--repo', REPO, '--pattern', 'latest.json', '--dir', oldDir]);
        if (!shouldAdvanceFeed(version, readJson(path.join(oldDir, 'latest.json')).version)) {
          console.log('Feed already points to this or a newer Dev build'); return;
        }
      }
    } else {
      gh(['release', 'create', FEED_TAG, '--repo', REPO, '--target', sourceSha, '--draft', '--prerelease', '--latest=false', '--title', 'Quorb Dev — update feed', '--notes', 'Rolling Dev manifest. Installers live in the linked immutable Dev prereleases. Never production.']);
    }
    gh(['release', 'upload', FEED_TAG, file, '--repo', REPO, '--clobber']);
    gh(['release', 'edit', FEED_TAG, '--repo', REPO, '--draft=false', '--prerelease', '--latest=false']);
    console.log(`Dev feed advanced to ${version}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, a, b, c] = process.argv.slice(2);
    if (command === 'prepare') {
      const { version } = prepareDev({ buildNumber: a, sourceSha: b });
      if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
      console.log(`Prepared Quorb Dev ${version} from ${b}`);
    } else if (command === 'validate') {
      validateDevManifest(readJson(a), { version: b, tag: c });
    } else if (command === 'publish-feed') {
      publishFeed({ version: a, tag: b, sourceSha: c });
    } else throw new Error('Usage: dev-channel.mjs prepare <build-number> <sha> | publish-feed <version> <dev-tag> <sha>');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
