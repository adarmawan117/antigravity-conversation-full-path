/**
 * AGTitleFullPath - Restore Backup Script
 * Mengembalikan file original agy.exe, workbench.desktop.main.js, dan jetskiAgent/main.js dari backup
 * dan menyinkronkan kembali checksum di product.json.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const userProfile = process.env.USERPROFILE || (process.env.HOMEDRIVE && process.env.HOMEPATH ? path.join(process.env.HOMEDRIVE, process.env.HOMEPATH) : path.join('C:', 'Users', process.env.USERNAME || 'User'));
const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');
const appData = process.env.APPDATA || path.join(userProfile, 'AppData', 'Roaming');

const appDir = path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources', 'app');
const jetskiFile = path.join(appDir, 'out', 'jetskiAgent', 'main.js');
const jetskiBackup = path.join(appDir, 'out', 'jetskiAgent', 'main.js.backup');

const wbFile = path.join(appDir, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
const wbBackup = path.join(appDir, 'out', 'vs', 'workbench', 'workbench.desktop.main.js.backup');

const agyFile = path.join(userProfile, '.gemini', 'bin', 'agy.exe');
const agyBackup = path.join(userProfile, '.gemini', 'bin', 'agy.exe.original');

const prodFile = path.join(appDir, 'product.json');
const codeCacheDir = path.join(appData, 'Antigravity IDE', 'Code Cache');

console.log('[1/3] Memulihkan file aplikasi dari backup...');

if (fs.existsSync(agyBackup)) {
  try {
    fs.copyFileSync(agyBackup, agyFile);
    console.log('      [OK] agy.exe berhasil dipulihkan.');
  } catch (e) {
    console.warn('      [WARN] Gagal memulihkan agy.exe (pastikan Antigravity IDE sudah ditutup):', e.message);
  }
}

if (fs.existsSync(jetskiBackup)) {
  fs.copyFileSync(jetskiBackup, jetskiFile);
  console.log('      [OK] jetskiAgent/main.js berhasil dipulihkan.');
}

if (fs.existsSync(wbBackup)) {
  fs.copyFileSync(wbBackup, wbFile);
  console.log('      [OK] workbench.desktop.main.js berhasil dipulihkan.');
}

console.log('[2/3] Menyinkronkan kembali checksum di product.json...');
if (fs.existsSync(prodFile)) {
  const prod = JSON.parse(fs.readFileSync(prodFile, 'utf8'));
  prod.checksums = prod.checksums || {};

  if (fs.existsSync(jetskiFile)) {
    prod.checksums['jetskiAgent/main.js'] = crypto.createHash('sha256').update(fs.readFileSync(jetskiFile)).digest('base64').replace(/=+$/, '');
  }
  if (fs.existsSync(wbFile)) {
    prod.checksums['vs/workbench/workbench.desktop.main.js'] = crypto.createHash('sha256').update(fs.readFileSync(wbFile)).digest('base64').replace(/=+$/, '');
  }

  fs.writeFileSync(prodFile, JSON.stringify(prod, null, '\t'), 'utf8');
  console.log('      [OK] Checksums berhasil disinkronkan ke nilai original.');
}

console.log('[3/3] Membersihkan V8 Code Cache...');
if (fs.existsSync(codeCacheDir)) {
  try {
    fs.rmSync(codeCacheDir, { recursive: true, force: true });
    console.log('      [OK] Code Cache dibersihkan.');
  } catch (e) {}
}

console.log('\n✅ SELESAI! Antigravity IDE telah dikembalikan ke kondisi default.');
console.log('Silakan tutup Antigravity IDE sepenuhnya lalu buka kembali dari awal.');
