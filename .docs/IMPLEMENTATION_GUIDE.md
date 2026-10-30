# Panduan Implementasi Kode (Code Surgery Guide)

Dokumen ini membedah kode sumber secara rinci dan menunjukkan baris-baris eksak yang dimodifikasi, baik pada binary utama **`agy.exe`** (penyedia web UI live sidebar) maupun pada lapisan file JavaScript fallback.

---

## 🎯 1. Target Utama: `agy.exe` (Embedded `main.js`)

File `agy.exe` memuat aset web React/Preact yang dikompresi dalam ZIP internal. Modifikasi diterapkan pada file `main.js` yang diekstrak dari arsip tersebut:

### A. Injeksi Header: Resolver Full Path & Dynamic Redux Lookup
Disuntikkan tepat di awal file `main.js`:
```javascript
window.__WORKSPACES_MAP__ = { /* Database JSON 141+ Workspace */ };

window.__formatUriToPath = function(uri) {
  if (!uri) return "";
  try {
    var s = decodeURIComponent(uri);
    s = s.replace(/^file:\/\/\/?([a-zA-Z]:)/, '$1').replace(/^file:\/\/\/?/, '/');
    if (/^[a-zA-Z]:/.test(s)) s = s.replace(/\//g, '\\');
    return s;
  } catch (e) {
    return uri;
  }
};

window.__getProjectFullPath = function(name, convId) {
  if (!name && !convId) return "";
  var map = window.__WORKSPACES_MAP__ || {};
  
  // 1. Direct map lookup by name
  if (name) {
    if (map[name]) return map[name];
    var lower = name.toLowerCase();
    if (map[lower]) return map[lower];
    for (var k in map) {
      if (k.toLowerCase() === lower || map[k].toLowerCase().endsWith('\\' + lower) || map[k].toLowerCase().endsWith('/' + lower)) {
        return map[k];
      }
    }
  }

  // 2. Redux store lookup (Proyek baru / percakapan baru)
  try {
    var store = window.__REDUX_STORE__;
    if (store && store.getState) {
      var state = store.getState();
      // Check sidebarProjects
      if (name && state.sidebarProjects && state.sidebarProjects.projects) {
        var p = state.sidebarProjects.projects.find(function(x) {
          return x.name === name || x.id === name || (x.name && x.name.toLowerCase() === name.toLowerCase());
        });
        if (p && p.folderUris && p.folderUris[0]) {
          var clean = window.__formatUriToPath(p.folderUris[0]);
          if (clean) return clean;
        }
      }
      // Check trajectorySummaries by convId
      if (convId && state.trajectorySummaries && state.trajectorySummaries.summaries) {
        var s = state.trajectorySummaries.summaries[convId];
        if (s) {
          var pId = s.trajectoryMetadata && s.trajectoryMetadata.projectId;
          if (pId && state.sidebarProjects && state.sidebarProjects.projects) {
            var pr = state.sidebarProjects.projects.find(function(x) { return x.id === pId; });
            if (pr && pr.folderUris && pr.folderUris[0]) {
              var clean2 = window.__formatUriToPath(pr.folderUris[0]);
              if (clean2) return clean2;
            }
          }
          var wu = s.trajectoryMetadata && s.trajectoryMetadata.workspaceUris;
          if (wu && wu[0]) {
            var clean3 = window.__formatUriToPath(wu[0]);
            if (clean3) return clean3;
          }
          var ws = s.workspaces;
          if (ws && ws[0] && ws[0].workspaceFolderAbsoluteUri) {
            var clean4 = window.__formatUriToPath(ws[0].workspaceFolderAbsoluteUri);
            if (clean4) return clean4;
          }
        }
      }
    }
  } catch (err) {}

  // 3. Fallback jika sudah berupa path disk
  if (name && (name.includes('/') || name.includes('\\'))) return name;
  return name || "";
};
```

---

### B. Hooking Redux Store pada Inisialisasi `KIa`
Agar fungsi resolusi dapat mengakses state Redux kapan saja:
```javascript
// KODE STOCK ORIGINAL:
y = KIa(x, b.critique ? { extraRtkqApis: [b.critique.reduxApi] } : void 0);

// KODE SETELAH MODIFIKASI:
y = KIa(x, b.critique ? { extraRtkqApis: [b.critique.reduxApi] } : void 0);
window.__REDUX_STORE__ = y;
```

---

### C. Modifikasi Komponen Baris Percakapan (`Bpc` -> Subtitle `tb`)
Inilah inti dari tata letak **RATA KIRI** dengan **ruang bernapas 25%**:

#### Kode Stock Original:
```javascript
tb = kb ? A.createElement("span", {
  className: Ni("flex items-center gap-1 w-full min-w-0 text-left text-muted-foreground select-none", w ? "text-sm" : "text-xs")
},
  kb.standalone && A.createElement(A.Fragment, null, A.createElement(Rs, { name: "chat", size: 14, className: "shrink-0" }), A.createElement("span", { className: eb.standalone }, kb.standalone)),
  kb.plain && A.createElement("span", { className: eb.plain }, kb.plain),
  kb.project && A.createElement(A.Fragment, null, A.createElement(T4b, { conversationId: a }), A.createElement("span", { className: eb.project }, kb.project)),
  kb.worktree && A.createElement(A.Fragment, null, A.createElement(Rs, { name: "call_split", size: 14, className: "shrink-0" }), A.createElement("span", { className: eb.worktree }, kb.worktree))
) : null;
```

#### Kode Setelah Modifikasi:
```javascript
tb = (() => {
  var _raw = kb?.project || kb?.standalone || kb?.plain || "";
  var _fp = window.__getProjectFullPath ? window.__getProjectFullPath(_raw, a) : _raw;
  return _raw ? A.createElement("span", {
    className: Ni("flex items-center gap-1 min-w-0 text-left text-muted-foreground select-none", w ? "text-sm" : "text-xs"),
    style: {
      display: "flex",
      maxWidth: "75%",
      justifyContent: "flex-start",
      alignItems: "center",
      marginRight: "auto"
    }
  },
  // 1. Ikon folder di sisi paling kiri
  A.createElement(T4b, { conversationId: a }),
  // 2. Teks path rata kiri, truncate dari kiri (RTL) dengan LRM protection
  A.createElement("span", {
    className: "truncate",
    title: _fp,
    style: {
      direction: "rtl",
      textAlign: "left",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      minWidth: 0,
      flexShrink: 1
    }
  }, "\u200E" + _fp + "\u200E")
  ) : null;
})();
```

---

## 🎯 2. Rekonstruksi & Kompresi Binary `agy.exe`

Setelah kode JS dimodifikasi, binary `agy.exe` direkonstruksi dengan script Python `patch_agy.py`:

```python
# 1. Kompresi raw DEFLATE level 7
co = zlib.compressobj(level=7, wbits=-zlib.MAX_WBITS)
part1 = co.compress(patched_js_bytes)
part2 = co.flush(zlib.Z_SYNC_FLUSH)
stream = part1 + part2

# 2. Sisipkan DEFLATE Stored Block untuk padding persis 3,271,174 bytes
target_csize = 3271174
remaining = target_csize - len(stream)
payload_len = remaining - 5
comment_payload = b'/*' + b' ' * (payload_len - 4) + b'*/'
header = struct.pack('<BHH', 0x01, payload_len, (~payload_len) & 0xFFFF)
stored_block = header + comment_payload
final_compressed = stream + stored_block
assert len(final_compressed) == target_csize

# 3. Hitung CRC32 dan ukuran uncompressed baru
decomp = zlib.decompress(final_compressed, -zlib.MAX_WBITS)
new_crc = zlib.crc32(decomp)
new_usize = len(decomp)

# 4. Tulis ke Local File Header (offset 183505679) & Central Directory (offset 187685536)
struct.pack_into('<I', data, 183505679 + 14, new_crc)
struct.pack_into('<I', data, 183505679 + 22, new_usize)
data[183505679 + 37 : 183505679 + 37 + target_csize] = final_compressed

struct.pack_into('<I', data, 187685536 + 16, new_crc)
struct.pack_into('<I', data, 187685536 + 24, new_usize)
```

---

## 🎯 3. Target Fallback: `jetskiAgent/main.js` & `workbench.desktop.main.js`

Untuk melengkapi cakupan jika aplikasi dijalankan tanpa backend daemon aktif:
- Pada `jetskiAgent/main.js`: Elemen `ea` diubah menggunakan struktur serupa dengan `justify-start` dan `max-w-[75%]`.
- Pada `workbench.desktop.main.js`: Elemen `Sc` diubah menggunakan struktur serupa dengan `justify-start` dan `max-w-[75%]`.
- File `product.json` diperbarui nilai hash SHA-256 base64-nya agar VS Code tidak memunculkan peringatan integritas.
