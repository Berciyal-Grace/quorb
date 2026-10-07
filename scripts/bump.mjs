// Sube la versión en package.json (la que usa Tauri) y en src-tauri/Cargo.toml.
//   npm run bump 0.2.0
import fs from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
  console.error('Uso: npm run bump <x.y.z>');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = version;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

const cargoPath = 'src-tauri/Cargo.toml';
const cargo = fs.readFileSync(cargoPath, 'utf8');
// Solo la primera `version = "…"`, la del [package].
fs.writeFileSync(cargoPath, cargo.replace(/^version = "[^"]+"/m, `version = "${version}"`));

console.log(`Versión ${version}. Ahora:\n  git commit -am "release v${version}"\n  git tag v${version}\n  git push && git push --tags`);
