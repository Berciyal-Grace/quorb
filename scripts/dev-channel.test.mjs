import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { devVersion, prepareDev, validateDevManifest, shouldAdvanceFeed, publishFeed } from './dev-channel.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sha = 'a'.repeat(40);
const url = 'https://github.com/egdev6/quorb/releases/download/dev-123-1/Quorb.Dev.setup.exe';
const manifest = () => ({ version: '0.0.2', platforms: { 'windows-x86_64': { url, signature: 'signed-artifact' } } });

test('build versions increase independently of stable and fit Windows MSI limits', () => {
  assert.equal(devVersion('1'), '0.0.1');
  assert.equal(devVersion('65535'), '0.0.65535');
  assert.equal(devVersion('65536'), '0.1.0');
  for (const bad of ['0', '-1', '1;echo x', '1.2', '16777216', '']) assert.throws(() => devVersion(bad));
});

test('prepare isolates installer and feed without writing production manifests', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'quorb-dev-'));
  try {
    fs.mkdirSync(path.join(cwd, 'src-tauri'));
    for (const file of ['tauri.conf.json', 'tauri.dev.conf.json']) fs.copyFileSync(path.join(root, 'src-tauri', file), path.join(cwd, 'src-tauri', file));
    const before = fs.readFileSync(path.join(cwd, 'src-tauri/tauri.conf.json'), 'utf8');
    const config = prepareDev({ cwd, buildNumber: '7', sourceSha: sha });
    assert.equal(config.version, '0.0.7');
    assert.equal(config.identifier, 'es.egdev.quorb.dev');
    assert.equal(config.productName, 'Quorb Dev');
    assert.equal(config.mainBinaryName, 'quorb-dev');
    assert.equal(config.app.windows[0].title, 'Quorb Dev');
    assert.deepEqual(config.plugins.updater.endpoints, ['https://github.com/egdev6/quorb/releases/download/dev-latest/latest.json']);
    assert.equal(config.bundle.createUpdaterArtifacts, true);
    assert.equal(config.bundle.windows.wix.upgradeCode, 'f2b6a76c-dc53-4d98-9280-9366ef0b1888');
    assert.equal(fs.readFileSync(path.join(cwd, 'src-tauri/tauri.conf.json'), 'utf8'), before);
    assert.deepEqual(fs.readdirSync(cwd).sort(), ['.dev-build', 'src-tauri']);
    assert.throws(() => prepareDev({ cwd, buildNumber: '8', sourceSha: 'main' }));
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('feed admits only this build and signed Windows assets from its immutable dev tag', () => {
  const args = { version: '0.0.2', tag: 'dev-123-1' };
  assert.doesNotThrow(() => validateDevManifest(manifest(), args));
  for (const change of [
    m => { m.version = '0.5.0'; },
    m => { m.platforms['windows-x86_64'].signature = ''; },
    m => { m.platforms['windows-x86_64'].url = url.replace('dev-123-1', 'v0.5.0'); },
    m => { m.platforms['windows-x86_64'].url = url.replace('https:', 'http:'); },
    m => { m.platforms['windows-x86_64'].url = url.replace('egdev6/quorb', 'attacker/quorb'); },
    m => { m.platforms = {}; },
    m => { m.platforms['windows-x86_64'].url += '?download=1'; },
  ]) {
    const m = manifest(); change(m);
    assert.throws(() => validateDevManifest(m, args));
  }
  assert.throws(() => validateDevManifest(manifest(), { ...args, tag: 'v0.5.0' }));
});

test('late builds and reruns never roll the dev feed backwards', () => {
  assert.equal(shouldAdvanceFeed('0.0.2', null), true);
  assert.equal(shouldAdvanceFeed('0.0.2', '0.0.1'), true);
  assert.equal(shouldAdvanceFeed('0.0.2', '0.0.2'), false);
  assert.equal(shouldAdvanceFeed('0.0.2', '0.1.0'), false);
  assert.throws(() => shouldAdvanceFeed('0.0.2', 'bad'));
});

function fakeGh({ previous = null, status = 404, prerelease = true, uploadFails = false } = {}) {
  const calls = [];
  const run = args => {
    calls.push(args);
    if (args[0] === 'api') {
      if (previous === null) throw Object.assign(new Error('API failed'), { stderr: `HTTP ${status}` });
      return JSON.stringify({ prerelease, draft: false, assets: [{ name: 'latest.json' }] });
    }
    if (args[1] === 'download') {
      const data = manifest();
      if (args[2] === 'dev-latest') data.version = previous;
      fs.writeFileSync(path.join(args[args.indexOf('--dir') + 1], 'latest.json'), JSON.stringify(data));
    }
    if (args[1] === 'upload' && uploadFails) throw new Error('Upload failed');
    return '';
  };
  return { run, calls };
}

const publish = run => publishFeed({ version: '0.0.2', tag: 'dev-123-1', sourceSha: sha, run });
const mutations = calls => calls.filter(args => ['create', 'upload', 'edit'].includes(args[1]));

test('bootstrap publishes only a Dev prerelease after validating its manifest', () => {
  const { run, calls } = fakeGh(); publish(run);
  assert.deepEqual(mutations(calls).map(args => args[1]), ['create', 'upload', 'edit']);
  assert.ok(mutations(calls).every(args => args[2] === 'dev-latest'));
  for (const args of mutations(calls).filter(args => args[1] !== 'upload')) {
    assert.ok(args.includes('--prerelease') && args.includes('--latest=false'));
  }
});

test('stale feed jobs never mutate the rolling release', () => {
  for (const previous of ['0.0.2', '0.0.3']) {
    const { run, calls } = fakeGh({ previous }); publish(run);
    assert.deepEqual(mutations(calls), []);
  }
});

test('permission/server errors and stable releases fail closed, not bootstrap', () => {
  for (const options of [{ status: 403 }, { status: 500 }, { previous: '0.0.1', prerelease: false }]) {
    const { run, calls } = fakeGh(options);
    assert.throws(() => publish(run)); assert.deepEqual(mutations(calls), []);
  }
});

test('failed upload cannot proceed to publishing the rolling release', () => {
  const { run, calls } = fakeGh({ previous: '0.0.1', uploadFails: true });
  assert.throws(() => publish(run), /Upload failed/);
  assert.deepEqual(mutations(calls).map(args => args[1]), ['upload']);
});

test('dev workflow never opts into stable latest or edits the stable release workflow', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/dev.yml'), 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /prerelease: true/);
  assert.match(workflow, /releaseDraft: true/);
  assert.match(workflow, /--latest=false/);
  assert.match(workflow, /group: dev-feed/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /setup:signing|release-check\.mjs|app:release/);
});
