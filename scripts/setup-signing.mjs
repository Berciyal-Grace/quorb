// Prepara las actualizaciones firmadas de Quorb en un solo paso:
//   npm run setup:signing
//
// 1. Genera el par de claves en ~/.tauri/quorb.key(.pub) si no existe (nunca la sobrescribe).
// 2. Pega la clave pública en src-tauri/tauri.conf.json.
// 3. Si tienes GitHub CLI con sesión iniciada, sube la clave privada y su contraseña
//    como secretos del repo (egdev6/quorb o el que pases con --repo owner/nombre).
// 4. Mueve docs/mover-a-.github a .github si aún está ahí.
//
// La clave privada no sale de tu equipo salvo hacia los secretos de GitHub.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const repoArg = process.argv.indexOf('--repo');
const REPO = repoArg > -1 ? process.argv[repoArg + 1] : 'egdev6/quorb';
const KEY = path.join(os.homedir(), '.tauri', 'quorb.key');
const PUB = KEY + '.pub';
const CONF = path.join('src-tauri', 'tauri.conf.json');

const ok = (m) => console.log(`✔ ${m}`);
const info = (m) => console.log(`• ${m}`);

const TAURI_CLI = path.join('node_modules', '@tauri-apps', 'cli', 'tauri.js');

/** Pide un texto sin mostrarlo en pantalla. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

if (!fs.existsSync(CONF)) {
  console.error('Ejecuta este script desde la raíz del proyecto (donde está package.json).');
  process.exit(1);
}

// 1 · Claves
let password = '';
if (fs.existsSync(KEY) && fs.existsSync(PUB)) {
  ok(`Ya tienes una clave en ${KEY}; la reutilizo.`);
  password = await askHidden('Contraseña de esa clave (para el secreto de GitHub; Enter si no tiene): ');
} else {
  info('Vas a generar la clave que firma las actualizaciones.');
  info('Guarda una copia de la clave y su contraseña: si la pierdes, las versiones instaladas no aceptarán actualizaciones nuevas.');
  password = await askHidden('Contraseña para la clave (Enter = sin contraseña): ');
  fs.mkdirSync(path.dirname(KEY), { recursive: true });
  if (!fs.existsSync(TAURI_CLI)) {
    console.error('Falta la CLI de Tauri: ejecuta antes «npm install».');
    process.exit(1);
  }
  // Se llama a la CLI con node directamente (sin shell) para que la contraseña no se rompa con espacios o comillas.
  const args = [TAURI_CLI, 'signer', 'generate', '-w', KEY, '--ci'];
  if (password) args.push('-p', password);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0 || !fs.existsSync(PUB)) {
    console.error('No se pudo generar la clave. ¿Has ejecutado antes «npm install»?');
    process.exit(1);
  }
  ok(`Clave creada en ${KEY}`);
}

// 2 · Clave pública en tauri.conf.json
const pub = fs.readFileSync(PUB, 'utf8').trim();
const conf = JSON.parse(fs.readFileSync(CONF, 'utf8'));
conf.plugins ??= {};
conf.plugins.updater ??= {};
if (conf.plugins.updater.pubkey === pub) {
  ok('La clave pública ya estaba en tauri.conf.json.');
} else {
  conf.plugins.updater.pubkey = pub;
  fs.writeFileSync(CONF, JSON.stringify(conf, null, 2) + '\n');
  ok('Clave pública guardada en src-tauri/tauri.conf.json.');
}

// 3 · Secretos de GitHub
const gh = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' });
if (gh.status === 0) {
  const repoExists = spawnSync('gh', ['repo', 'view', REPO], { stdio: 'ignore' }).status === 0;
  if (!repoExists) {
    info(`El repo ${REPO} aún no existe en GitHub. Créalo y vuelve a ejecutar este script para subir los secretos.`);
  } else {
    const key = fs.readFileSync(KEY, 'utf8');
    const a = spawnSync('gh', ['secret', 'set', 'TAURI_SIGNING_PRIVATE_KEY', '--repo', REPO], { input: key });
    const b = spawnSync('gh', ['secret', 'set', 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD', '--repo', REPO], { input: password });
    if (a.status === 0 && b.status === 0) ok(`Secretos subidos a ${REPO}.`);
    else info('No pude subir los secretos con gh; añádelos a mano (ver abajo).');
  }
} else {
  info('No encuentro GitHub CLI con sesión iniciada («gh auth login»). Añade estos secretos a mano en');
  info(`  https://github.com/${REPO}/settings/secrets/actions`);
  info(`  TAURI_SIGNING_PRIVATE_KEY           = contenido de ${KEY}`);
  info('  TAURI_SIGNING_PRIVATE_KEY_PASSWORD  = la contraseña que acabas de escribir');
}

// 4 · Carpeta .github
const pending = path.join('docs', 'mover-a-.github');
if (fs.existsSync(pending)) {
  fs.mkdirSync('.github', { recursive: true });
  for (const entry of fs.readdirSync(pending)) {
    const to = path.join('.github', entry);
    if (fs.existsSync(to)) fs.cpSync(path.join(pending, entry), to, { recursive: true, force: false, errorOnExist: false });
    else fs.renameSync(path.join(pending, entry), to);
  }
  fs.rmSync(pending, { recursive: true, force: true });
  ok('Workflow y plantillas movidos a .github/.');
}

console.log(`
Listo. Para compilar un instalador firmado en local:
  $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw "${KEY}"
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<tu contraseña>"
  npm run app:release
O sin firma (no genera los ficheros del updater): npm run app:build`);
