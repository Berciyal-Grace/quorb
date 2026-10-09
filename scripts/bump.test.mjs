import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bumpVersion, compareVersions, isValidVersion } from './bump.mjs';

const OWNED = ['package.json', 'package-lock.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];

function makeRepo(version = '0.1.0', overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quorb-bump-'));
  fs.mkdirSync(path.join(dir, 'src-tauri'), { recursive: true });
  const files = {
    'package.json': JSON.stringify({ name: 'quorb', version }, null, 2) + '\n',
    'package-lock.json':
      JSON.stringify(
        {
          name: 'quorb',
          version,
          lockfileVersion: 3,
          packages: { '': { name: 'quorb', version }, 'node_modules/serde': { version: '9.9.9' } },
        },
        null,
        2,
      ) + '\n',
    'src-tauri/Cargo.toml': `[package]\nname = "quorb"\nversion = "${version}"\n\n[dependencies]\nserde = "1"\n`,
    'src-tauri/Cargo.lock': `version = 4\n\n[[package]]\nname = "quorb"\nversion = "${version}"\n\n[[package]]\nname = "serde"\nversion = "1.0.0"\n`,
    ...overrides,
  };
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), content);
  return dir;
}

const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const snapshot = (dir) =>
  OWNED.map((file) => {
    const full = path.join(dir, file);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '<missing>';
  }).join('\0');

test('bumpVersion actualiza los cuatro manifiestos y solo la versión propia', () => {
  const dir = makeRepo();
  bumpVersion('0.1.1', { cwd: dir });

  assert.equal(JSON.parse(read(dir, 'package.json')).version, '0.1.1');
  const lock = JSON.parse(read(dir, 'package-lock.json'));
  assert.equal(lock.version, '0.1.1');
  assert.equal(lock.packages[''].version, '0.1.1');
  assert.equal(lock.packages['node_modules/serde'].version, '9.9.9');
  assert.match(read(dir, 'src-tauri/Cargo.toml'), /^version = "0\.1\.1"$/m);
  const cargoLock = read(dir, 'src-tauri/Cargo.lock');
  assert.match(cargoLock, /name = "quorb"\nversion = "0\.1\.1"/);
  assert.match(cargoLock, /name = "serde"\nversion = "1\.0\.0"/);
});

test('bumpVersion rechaza versiones inválidas sin escribir', () => {
  const dir = makeRepo();
  const before = snapshot(dir);
  assert.throws(() => bumpVersion('0.1', { cwd: dir }), /no válida/i);
  assert.throws(() => bumpVersion('0.1.1; rm -rf /', { cwd: dir }), /no válida/i);
  assert.throws(() => bumpVersion(undefined, { cwd: dir }), /no válida/i);
  assert.equal(snapshot(dir), before);
});

test('bumpVersion rechaza versiones no crecientes', () => {
  const dir = makeRepo('0.2.0');
  assert.throws(() => bumpVersion('0.2.0', { cwd: dir }), /no es mayor/i);
  assert.throws(() => bumpVersion('0.1.9', { cwd: dir }), /no es mayor/i);
});

test('bumpVersion rechaza manifiestos incoherentes sin escribir', () => {
  const dir = makeRepo('0.1.0', {
    'src-tauri/Cargo.toml': `[package]\nname = "quorb"\nversion = "0.0.9"\n`,
  });
  const before = snapshot(dir);
  assert.throws(() => bumpVersion('0.1.1', { cwd: dir }), /incoherentes/i);
  assert.equal(snapshot(dir), before);
});

test('bumpVersion falla si falta un manifiesto antes de escribir nada', () => {
  const dir = makeRepo();
  fs.rmSync(path.join(dir, 'src-tauri/Cargo.lock'));
  const before = snapshot(dir);
  assert.throws(() => bumpVersion('0.1.1', { cwd: dir }), /Falta/);
  assert.equal(snapshot(dir), before);
});

test('isValidVersion rechaza SemVer mal formado', () => {
  for (const bad of ['01.2.3', '1.02.3', '1.2.03', '1.2', '1.2.3-', '1.2.3-rc..1', '1.2.3-alpha.', '1.2.3-01', '1.2.3-a b', '1.2.3;id', '../1.2.3']) {
    assert.equal(isValidVersion(bad), false, `esperaba inválida: ${bad}`);
  }
  for (const good of ['0.1.0', '1.2.3', '1.2.3-rc.1', '1.2.3-0', '1.2.3-alpha-1']) {
    assert.equal(isValidVersion(good), true, `esperaba válida: ${good}`);
  }
});

test('compareVersions respeta SemVer', () => {
  assert.equal(compareVersions('0.1.1', '0.1.0'), 1);
  assert.equal(compareVersions('0.1.0', '0.1.0'), 0);
  assert.equal(compareVersions('1.0.0-rc.1', '1.0.0'), -1);
  assert.equal(compareVersions('1.0.0-rc.2', '1.0.0-rc.10'), -1);
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0-alpha.1'), -1);
  assert.equal(compareVersions('1.0.0-1', '1.0.0-alpha'), -1);
});

test('bumpVersion lee y escribe la versión de [package], no la primera del fichero', () => {
  const dir = makeRepo('0.1.0', {
    'src-tauri/Cargo.toml': `[workspace.package]\nversion = "9.9.9"\n\n[package]\nname = "quorb"\nversion = "0.1.0"\n`,
  });
  bumpVersion('0.1.1', { cwd: dir });
  const toml = read(dir, 'src-tauri/Cargo.toml');
  assert.match(toml, /\[workspace\.package\]\nversion = "9\.9\.9"/);
  assert.match(toml, /\[package\]\nname = "quorb"\nversion = "0\.1\.1"/);
});
