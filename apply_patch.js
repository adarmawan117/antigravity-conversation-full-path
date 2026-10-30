/**
 * AGTitleFullPath - Automated Patch Script
 * Mengubah nama project pada sidebar Antigravity IDE menjadi Full File System Path,
 * tata letak RATA KIRI, truncate dari kiri (direction: rtl, text-align: left),
 * disisakan ruang bernapas 25% di sisi kanan baris (max-width: 75%),
 * bebas error korupsi instalasi, dan mendukung resolusi dinamis untuk project baru.
 * 
 * Melakukan patch serentak pada tiga lapisan:
 * 1. Antigravity Backend Hub Binary: agy.exe (penyedia web static utama UI sidebar)
 * 2. Antigravity Agent Window UI:    jetskiAgent/main.js
 * 3. VS Code Core Workbench:         vs/workbench/workbench.desktop.main.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const userProfile = process.env.USERPROFILE || (process.env.HOMEDRIVE && process.env.HOMEPATH ? path.join(process.env.HOMEDRIVE, process.env.HOMEPATH) : path.join('C:', 'Users', process.env.USERNAME || 'User'));
const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');
const appData = process.env.APPDATA || path.join(userProfile, 'AppData', 'Roaming');

const appDir = path.join(localAppData, 'Programs', 'Antigravity IDE', 'resources', 'app');
const jetskiFile = path.join(appDir, 'out', 'jetskiAgent', 'main.js');
const jetskiBackup = path.join(appDir, 'out', 'jetskiAgent', 'main.js.backup');

const wbFile = path.join(appDir, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
const wbBackup = path.join(appDir, 'out', 'vs', 'workbench', 'workbench.desktop.main.js.backup');

const prodFile = path.join(appDir, 'product.json');
const storageDir = path.join(appData, 'Antigravity IDE', 'User', 'workspaceStorage');
const codeCacheDir = path.join(appData, 'Antigravity IDE', 'Code Cache');

// 0. Patch agy.exe via python patch_agy.py
console.log('===============================================================');
console.log('  AGTitleFullPath - Antigravity IDE Sidebar Patcher (Rata Kiri)');
console.log('===============================================================\n');

console.log('[1/6] Memodifikasi binary agy.exe (Hub Web UI)...');
const patchAgyScript = path.join(__dirname, 'patch_agy.py');
if (fs.existsSync(patchAgyScript)) {
  try {
    execSync(`python "${patchAgyScript}"`, { stdio: 'inherit' });
  } catch (err) {
    console.warn('      [WARN] Gagal memodifikasi agy.exe secara otomatis:', err.message);
  }
} else {
  console.warn('      [WARN] patch_agy.py tidak ditemukan.');
}

if (!fs.existsSync(wbFile) || !fs.existsSync(jetskiFile)) {
  console.log('\n[INFO] File jetskiAgent atau workbench tidak ditemukan di resources/app.');
  console.log('Patch pada binary agy.exe sudah selesai!');
  process.exit(0);
}

// 1. Scan workspaces
console.log('\n[2/6] Memindai workspace yang terdaftar di Antigravity IDE...');
const map = {};

if (fs.existsSync(storageDir)) {
  const entries = fs.readdirSync(storageDir);
  for (const entry of entries) {
    const wsJson = path.join(storageDir, entry, 'workspace.json');
    if (fs.existsSync(wsJson)) {
      try {
        const data = JSON.parse(fs.readFileSync(wsJson, 'utf8'));
        const uri = data.folder || (data.configuration && data.configuration.fsPath);
        if (uri) {
          let decoded = decodeURIComponent(uri);
          decoded = decoded.replace(/^file:\/\/\/?([a-zA-Z]:)/, '$1').replace(/^file:\/\/\/?/, '/');
          if (/^[a-zA-Z]:/.test(decoded)) decoded = decoded.replace(/\//g, '\\');
          const base = path.basename(decoded);
          map[base] = decoded;
          map[base.toLowerCase()] = decoded;
        }
      } catch (e) {}
    }
  }
}
console.log(`      Ditemukan ${Object.keys(map).length / 2} direktori workspace unik.`);

// 2. Buat Backup jika belum ada
console.log('[3/6] Memeriksa file backup original...');
if (!fs.existsSync(jetskiBackup)) {
  fs.copyFileSync(jetskiFile, jetskiBackup);
  console.log('      [OK] Backup jetskiAgent/main.js dibuat.');
}
if (!fs.existsSync(wbBackup)) {
  fs.copyFileSync(wbFile, wbBackup);
  console.log('      [OK] Backup workbench.desktop.main.js dibuat.');
}

// 3. Patch jetskiAgent/main.js
console.log('[4/6] Membaca dan menerapkan patch pada jetskiAgent/main.js...');
let js = fs.readFileSync(jetskiFile, 'utf8');

const banner = '/*!--------------------------------------------------------\n * Copyright (C) Microsoft Corporation. All rights reserved.\n *--------------------------------------------------------*/';
const injectHeader = banner + '(function(){var g=typeof window!=="undefined"?window:globalThis;g.__WORKSPACES_MAP__=' + JSON.stringify(map) + ';g._adrDec=function(u){if(!u)return null;if(typeof u==="object")u=u.fsPath||u.path||String(u);if(typeof u!=="string")return null;try{var s=decodeURIComponent(u);s=s.replace(/^vscode-file:\\/\\/vscode-app\\/?/i,"");s=s.replace(/^file:\\/\\/\\/?([a-zA-Z]:)/i,"$1").replace(/^file:\\/\\/\\/?/,"/");if(/^[a-zA-Z]:/.test(s))s=s.replace(/\\//g,"\\\\");return(s.includes("\\\\")||s.startsWith("/"))?s:null;}catch(e){return null;}};g._adrLookup=function(v,u){if(!v||typeof v!=="string")return v;if(v==="Outside of Project"||v==="Standalone")return v;if(v.includes("\\\\")||(v.startsWith("/")&&v.indexOf("/",1)!==-1))return v;var m=g.__WORKSPACES_MAP__||{};if(m[v])return m[v];var l=v.toLowerCase();if(m[l])return m[l];for(var k in m){if(k.toLowerCase()===l||m[k].toLowerCase().endsWith("\\\\"+l)||m[k].toLowerCase().endsWith("/"+l))return m[k];}if(u){var d=g._adrDec(u);if(d){m[v]=d;m[l]=d;return d;}}return v;};})();';

const headerMarker = 'g.__WORKSPACES_MAP__=';
if (js.includes(headerMarker)) {
  const commentIdx = js.indexOf(banner);
  const codeIdx = js.indexOf('var UQn=Object.create');
  if (commentIdx !== -1 && codeIdx !== -1) {
    js = injectHeader + js.substring(codeIdx);
    console.log('      [OK] Header Map & Dynamic Resolver diperbarui.');
  }
} else if (js.startsWith(banner)) {
  js = injectHeader + js.substring(banner.length);
  console.log('      [OK] Header Map & Dynamic Resolver berhasil disuntikkan.');
} else {
  js = injectHeader + js;
}

const targetBunStock = 'let A=eUa({worktree:i?p:void 0,project:s,standaloneWorkspace:m,isStandalone:E,isPinned:t,context:r});';
const targetBunOldPatched = 'let _fullP=(globalThis._adrLookup?globalThis._adrLookup(s):s)||s;let _fullM=(globalThis._adrLookup?globalThis._adrLookup(m):m)||m;let A=eUa({worktree:i?p:void 0,project:_fullP,standaloneWorkspace:_fullM,isStandalone:E,isPinned:t,context:r});';
const replaceBun = 'let _cw=n.get("currentWorkspace")?.workspaceUri,_cd=h||_cw;let _fullP=(globalThis._adrLookup?globalThis._adrLookup(s,_cd):s)||s;let _fullM=(globalThis._adrLookup?globalThis._adrLookup(m,_cd):m)||m;let A=eUa({worktree:i?p:void 0,project:_fullP,standaloneWorkspace:_fullM,isStandalone:E,isPinned:t,context:r});';

if (js.includes(targetBunStock)) {
  js = js.replace(targetBunStock, replaceBun);
  console.log('      [OK] Subtitle resolver (bun) diperbarui dari stock.');
} else if (js.includes(targetBunOldPatched)) {
  js = js.replace(targetBunOldPatched, replaceBun);
  console.log('      [OK] Subtitle resolver (bun) ditingkatkan ke versi dinamis.');
} else {
  console.log('      [INFO] Subtitle resolver (bun) sudah dalam versi dinamis.');
}

const targetEaPrefix = 'onStopClick:St?we:void 0},ea=';
const targetEaIdx = js.indexOf(targetEaPrefix);
if (targetEaIdx !== -1) {
  const endMarker = ',en=t===';
  const endIdx = js.indexOf(endMarker, targetEaIdx);
  if (endIdx !== -1) {
    const replaceEaCode = '$e?d("span",{className:"flex items-center justify-start gap-1 max-w-[75%] min-w-0 text-xs text-left text-muted-foreground select-none",style:{display:"flex",maxWidth:"75%",justifyContent:"flex-start",alignItems:"center",marginRight:"auto"},children:[$e.standalone&&d(Oe,{children:[d(de,{name:"chat",size:14,className:"shrink-0"}),d("span",{className:"min-w-0 truncate",style:{direction:"rtl",textAlign:"left"},title:(globalThis._adrLookup?globalThis._adrLookup($e.standalone):$e.standalone),children:"\\u200E"+(globalThis._adrLookup?globalThis._adrLookup($e.standalone):$e.standalone)+"\\u200E"})]}),$e.plain&&d(Oe,{children:[d(de,{name:"folder",size:14,className:"shrink-0"}),d("span",{className:"min-w-0 truncate",style:{direction:"rtl",textAlign:"left"},title:(globalThis._adrLookup?globalThis._adrLookup($e.plain):$e.plain),children:"\\u200E"+(globalThis._adrLookup?globalThis._adrLookup($e.plain):$e.plain)+"\\u200E"})]}),$e.project&&d(Oe,{children:[d(de,{name:"folder",size:14,className:"shrink-0"}),d("span",{className:"min-w-0 truncate",style:{direction:"rtl",textAlign:"left"},title:(globalThis._adrLookup?globalThis._adrLookup($e.project):$e.project),children:"\\u200E"+(globalThis._adrLookup?globalThis._adrLookup($e.project):$e.project)+"\\u200E"})]}),$e.worktree&&d(Oe,{children:[d(de,{name:"call_split",size:14,className:"shrink-0"}),d("span",{className:"min-w-0 truncate",style:{direction:"rtl",textAlign:"left"},title:(globalThis._adrLookup?globalThis._adrLookup($e.worktree):$e.worktree),children:"\\u200E"+(globalThis._adrLookup?globalThis._adrLookup($e.worktree):$e.worktree)+"\\u200E"})]})]}):null';
    js = js.substring(0, targetEaIdx + targetEaPrefix.length) + replaceEaCode + js.substring(endIdx);
    console.log('      [OK] Subtitle UI renderer (ea) disetel rata kiri (75% baris).');
  }
}
fs.writeFileSync(jetskiFile, js, 'utf8');

// 4. Patch vs/workbench/workbench.desktop.main.js
console.log('[5/6] Membaca dan menerapkan patch pada workbench.desktop.main.js...');
let wb = fs.readFileSync(wbFile, 'utf8');

const wbHeaderMarker = 'window.__WORKSPACES_MAP__ = ';
const wbHeader = banner + '\nwindow.__WORKSPACES_MAP__ = ' + JSON.stringify(map) + ';\nwindow._adrLookup = function(v){ if(!v||typeof v!=="string") return v; if(v==="Outside of Project"||v==="Standalone") return v; if(v.includes("\\\\")||(v.startsWith("/")&&v.indexOf("/",1)!==-1)) return v; var m=window.__WORKSPACES_MAP__||{}; if(m[v]) return m[v]; var l=v.toLowerCase(); if(m[l]) return m[l]; for(var k in m){ if(k.toLowerCase()===l||m[k].toLowerCase().endsWith("\\\\"+l)||m[k].toLowerCase().endsWith("/"+l)) return m[k]; } return v; };\n';

if (wb.includes(wbHeaderMarker)) {
  const commentIdx = wb.indexOf(banner);
  const codeIdx = wb.indexOf('define(["require",');
  if (commentIdx !== -1 && codeIdx !== -1) {
    wb = wbHeader + wb.substring(codeIdx);
    console.log('      [OK] Header Map pada workbench diperbarui.');
  }
} else if (wb.startsWith(banner)) {
  wb = wbHeader + wb.substring(banner.length);
  console.log('      [OK] Header Map pada workbench berhasil disuntikkan.');
} else {
  wb = wbHeader + wb;
}

const targetScPrefix = 'onStopClick:ii?ct:void 0},Sc=';
const targetScIdx = wb.indexOf(targetScPrefix);
if (targetScIdx !== -1) {
  const endMarker = ',cs=e===';
  const endIdx = wb.indexOf(endMarker, targetScIdx);
  if (endIdx !== -1) {
    const replaceScCode = 'Nt?v("span",{className:"flex items-center justify-start gap-1 max-w-[75%] min-w-0 text-xs text-left text-muted-foreground select-none",style:{display:"flex",maxWidth:"75%",justifyContent:"flex-start",alignItems:"center",marginRight:"auto"},children:[Nt.standalone&&v(yt,{children:[v(Re,{name:"chat",size:14,className:"shrink-0"}),v("span",{className:"min-w-0 truncate",style:{direction:"rtl",textAlign:"left"},title:(window._adrLookup?window._adrLookup(Nt.standalone):Nt.standalone),children:"\\u200E"+(window._adrLookup?window._adrLookup(Nt.standalone):Nt.standalone)+"\\u200E"})]}),Nt.plain&&v(yt,{children:[v(Re,{name:"folder",size:14,className:"shrink-0"}),v("span",{className:"min-w-0 truncate",style:{direction:"rtl",textAlign:"left"},title:(window._adrLookup?window._adrLookup(Nt.plain):Nt.plain),children:"\\u200E"+(window._adrLookup?window._adrLookup(Nt.plain):Nt.plain)+"\\u200E"})]}),Nt.project&&v(yt,{children:[v(Re,{name:"folder",size:14,className:"shrink-0"}),v("span",{className:"min-w-0 truncate",style:{direction:"rtl",textAlign:"left"},title:(window._adrLookup?window._adrLookup(Nt.project):Nt.project),children:"\\u200E"+(window._adrLookup?window._adrLookup(Nt.project):Nt.project)+"\\u200E"})]}),Nt.worktree&&v(yt,{children:[v(Re,{name:"call_split",size:14,className:"shrink-0"}),v("span",{className:"min-w-0 truncate",style:{direction:"rtl",textAlign:"left"},title:(window._adrLookup?window._adrLookup(Nt.worktree):Nt.worktree),children:"\\u200E"+(window._adrLookup?window._adrLookup(Nt.worktree):Nt.worktree)+"\\u200E"})]})]}):null';
    wb = wb.substring(0, targetScIdx + targetScPrefix.length) + replaceScCode + wb.substring(endIdx);
    console.log('      [OK] Subtitle UI renderer (Sc) pada workbench disetel rata kiri (75% baris).');
  }
}
fs.writeFileSync(wbFile, wb, 'utf8');

// 5. Update Checksums di product.json
if (fs.existsSync(prodFile)) {
  const prod = JSON.parse(fs.readFileSync(prodFile, 'utf8'));
  prod.checksums = prod.checksums || {};

  const hashJetski = crypto.createHash('sha256').update(fs.readFileSync(jetskiFile)).digest('base64').replace(/=+$/, '');
  const hashWb = crypto.createHash('sha256').update(fs.readFileSync(wbFile)).digest('base64').replace(/=+$/, '');

  prod.checksums['jetskiAgent/main.js'] = hashJetski;
  prod.checksums['vs/workbench/workbench.desktop.main.js'] = hashWb;

  fs.writeFileSync(prodFile, JSON.stringify(prod, null, '\t'), 'utf8');
}

// 6. Bersihkan Code Cache
console.log('[6/6] Membersihkan cache bytecode V8...');
if (fs.existsSync(codeCacheDir)) {
  try {
    fs.rmSync(codeCacheDir, { recursive: true, force: true });
    console.log('      [OK] V8 Code Cache berhasil dihapus.');
  } catch (e) {}
}

console.log('\n🎉 SUKSES! Modifikasi Full Path selesai diterapkan serentak pada agy.exe, Workbench, & JetskiAgent.');
console.log('Layout: [icon folder] [....] [full path rata kiri] [space 25%]');
console.log('Silakan restart Antigravity IDE untuk melihat perubahan.');
