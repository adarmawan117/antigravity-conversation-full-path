"""
AGTitleFullPath - agy.exe Binary Patcher
========================================
Memodifikasi file binary C:\\Users\\<User>\\.gemini\\bin\\agy.exe secara langsung.
agy.exe bertindak sebagai backend server & static web server untuk UI Sidebar Antigravity IDE.

Modifikasi:
1. Menampilkan Full File System Path untuk setiap proyek di sidebar percakapan.
2. Tata letak Rata Kiri:
   pembatas kiri -> | [icon folder] [....] [full path rata kiri] [space 25%] | <- Pembatas kanan
3. Truncate dari kiri (direction: rtl, text-align: left) sehingga folder proyek utama di ujung kanan tetap utuh terbaca.
4. Ruang bernapas 25% di sebelah kanan (max-width: 75%, margin-right: auto).
5. Resolusi otomatis untuk project lama (via map) dan project baru (via Redux store).
"""

import os
import sys
import json
import urllib.parse
import struct
import zlib
import zipfile
import io
import shutil

USER_PROFILE = os.environ.get('USERPROFILE', os.path.expanduser('~'))
APPDATA = os.environ.get('APPDATA', os.path.join(USER_PROFILE, 'AppData', 'Roaming'))
AGY_PATH = os.path.join(USER_PROFILE, '.gemini', 'bin', 'agy.exe')
BACKUP_PATH = os.path.join(USER_PROFILE, '.gemini', 'bin', 'agy.exe.original')
WORKSPACE_STORAGE = os.path.join(APPDATA, 'Antigravity IDE', 'User', 'workspaceStorage')

def scan_workspaces():
    print("[1/5] Memindai database workspace di workspaceStorage...")
    ws_map = {}
    if os.path.exists(WORKSPACE_STORAGE):
        for entry in os.listdir(WORKSPACE_STORAGE):
            ws_file = os.path.join(WORKSPACE_STORAGE, entry, 'workspace.json')
            if os.path.exists(ws_file):
                try:
                    with open(ws_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    uri = data.get('folder') or (data.get('configuration') and data['configuration'].get('fsPath'))
                    if uri:
                        decoded = urllib.parse.unquote(uri)
                        decoded = decoded.replace('file:///', '').replace('file://', '')
                        if len(decoded) > 1 and decoded[1] == ':':
                            decoded = decoded.replace('/', '\\')
                        base = os.path.basename(decoded.rstrip('\\/'))
                        if base:
                            ws_map[base] = decoded
                            ws_map[base.lower()] = decoded
                except Exception:
                    pass
    print(f"      Ditemukan {len(ws_map) // 2} direktori workspace unik.")
    return ws_map

def apply_patch():
    if not os.path.exists(AGY_PATH):
        print(f"[ERROR] Binary agy.exe tidak ditemukan di: {AGY_PATH}")
        sys.exit(1)

    # 1. Backup original binary
    if not os.path.exists(BACKUP_PATH):
        print(f"[2/5] Membuat backup permanen agy.exe ke: {BACKUP_PATH}")
        shutil.copyfile(AGY_PATH, BACKUP_PATH)
    else:
        print(f"[2/5] Backup permanen sudah ada di: {BACKUP_PATH}")

    # Selalu gunakan source dari BACKUP_PATH agar bersih dan idempoten
    with open(BACKUP_PATH, 'rb') as f:
        data = bytearray(f.read())

    # 2. Baca workspace map
    ws_map = scan_workspaces()

    # 3. Ekstraksi main.js original dari embedded zip
    print("[3/5] Mengekstraksi main.js dari embedded zip archive di agy.exe...")
    zip_start = 183368780
    eocd_pos = 187710613
    zip_bytes = bytes(data[zip_start:eocd_pos + 22])
    z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    raw_js = z.read('main.js').decode('utf-8')
    print(f"      Ukuran main.js original: {len(raw_js):,} karakter.")

    # 4. Modifikasi JavaScript
    print("[4/5] Menerapkan modifikasi logika path, Redux hook, dan UI Rata Kiri...")
    
    # A. Helper code di header
    helper_code = f"""
window.__WORKSPACES_MAP__ = {json.dumps(ws_map)};
window.__formatUriToPath = function(uri) {{
  if (!uri) return "";
  try {{
    var s = decodeURIComponent(uri);
    s = s.replace(/^file:\\/\\/\\/?([a-zA-Z]:)/, '$1').replace(/^file:\\/\\/\\/?/, '/');
    if (/^[a-zA-Z]:/.test(s)) s = s.replace(/\\//g, '\\\\');
    return s;
  }} catch (e) {{
    return uri;
  }}
}};
window.__getProjectFullPath = function(name, convId) {{
  if (!name && !convId) return "";
  var map = window.__WORKSPACES_MAP__ || {{}};
  
  if (name) {{
    if (map[name]) return map[name];
    var lower = name.toLowerCase();
    if (map[lower]) return map[lower];
    for (var k in map) {{
      if (k.toLowerCase() === lower || map[k].toLowerCase().endsWith('\\\\' + lower) || map[k].toLowerCase().endsWith('/' + lower)) {{
        return map[k];
      }}
    }}
  }}

  try {{
    var store = window.__REDUX_STORE__;
    if (store && store.getState) {{
      var state = store.getState();
      if (name && state.sidebarProjects && state.sidebarProjects.projects) {{
        var p = state.sidebarProjects.projects.find(function(x) {{
          return x.name === name || x.id === name || (x.name && x.name.toLowerCase() === name.toLowerCase());
        }});
        if (p && p.folderUris && p.folderUris[0]) {{
          var clean = window.__formatUriToPath(p.folderUris[0]);
          if (clean) return clean;
        }}
      }}
      if (convId && state.trajectorySummaries && state.trajectorySummaries.summaries) {{
        var s = state.trajectorySummaries.summaries[convId];
        if (s) {{
          var pId = s.trajectoryMetadata && s.trajectoryMetadata.projectId;
          if (pId && state.sidebarProjects && state.sidebarProjects.projects) {{
            var pr = state.sidebarProjects.projects.find(function(x) {{ return x.id === pId; }});
            if (pr && pr.folderUris && pr.folderUris[0]) {{
              var clean2 = window.__formatUriToPath(pr.folderUris[0]);
              if (clean2) return clean2;
            }}
          }}
          var wu = s.trajectoryMetadata && s.trajectoryMetadata.workspaceUris;
          if (wu && wu[0]) {{
            var clean3 = window.__formatUriToPath(wu[0]);
            if (clean3) return clean3;
          }}
          var ws = s.workspaces;
          if (ws && ws[0] && ws[0].workspaceFolderAbsoluteUri) {{
            var clean4 = window.__formatUriToPath(ws[0].workspaceFolderAbsoluteUri);
            if (clean4) return clean4;
          }}
        }}
      }}
    }}
  }} catch (err) {{}}

  if (name && (name.includes('/') || name.includes('\\\\'))) return name;
  return name || "";
}};
"""
    code = helper_code + raw_js

    # B. Hook Redux Store
    target_kia = 'y=KIa(x,b.critique?{extraRtkqApis:[b.critique.reduxApi]}:void 0);'
    replace_kia = 'y=KIa(x,b.critique?{extraRtkqApis:[b.critique.reduxApi]}:void 0);window.__REDUX_STORE__=y;'
    if target_kia in code:
        code = code.replace(target_kia, replace_kia)
        print("      [OK] Hook window.__REDUX_STORE__ berhasil dipasang.")
    else:
        print("      [WARN] Pola targetKIa tidak ditemukan.")

    # C. Patch UI Subtitle Bpc (Rata Kiri, RTL Truncate, 25% Breathing Space)
    target_tb = 'tb=kb?A.createElement("span",{className:Ni("flex items-center gap-1 w-full min-w-0 text-left text-muted-foreground select-none",\nw?"text-sm":"text-xs")},kb.standalone&&A.createElement(A.Fragment,null,A.createElement(Rs,{name:"chat",size:14,className:"shrink-0"}),A.createElement("span",{className:eb.standalone},kb.standalone)),kb.plain&&A.createElement("span",{className:eb.plain},kb.plain),kb.project&&A.createElement(A.Fragment,null,A.createElement(T4b,{conversationId:a}),A.createElement("span",{className:eb.project},kb.project)),kb.worktree&&A.createElement(A.Fragment,null,A.createElement(Rs,{name:"call_split",size:14,className:"shrink-0"}),\nA.createElement("span",{className:eb.worktree},kb.worktree))):null'
    replace_tb = 'tb=(()=>{var _raw=kb?.project||kb?.standalone||kb?.plain||"";var _fp=window.__getProjectFullPath?window.__getProjectFullPath(_raw,a):_raw;return _raw?A.createElement("span",{className:Ni("flex items-center gap-1 min-w-0 text-left text-muted-foreground select-none",w?"text-sm":"text-xs"),style:{display:"flex",maxWidth:"75%",justifyContent:"flex-start",alignItems:"center",marginRight:"auto"}},A.createElement(T4b,{conversationId:a}),A.createElement("span",{className:"truncate",title:_fp,style:{direction:"rtl",textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0,flexShrink:1}},"\\u200E"+_fp+"\\u200E")):null})()'

    if target_tb in code:
        code = code.replace(target_tb, replace_tb)
        print("      [OK] Subtitle renderer Bpc berhasil diubah menjadi Rata Kiri (max-width: 75%).")
    else:
        print("      [ERROR] Pola targetTb tidak ditemukan di code!")
        sys.exit(1)

    # 5. Kompresi & Rekonstruksi Binary
    print("[5/5] Mengompresi stream DEFLATE dan memperbarui header binary...")
    patched_js_bytes = code.encode('utf-8')
    target_csize = 3271174

    co = zlib.compressobj(level=7, wbits=-zlib.MAX_WBITS)
    part1 = co.compress(patched_js_bytes)
    part2 = co.flush(zlib.Z_SYNC_FLUSH)
    stream = part1 + part2

    remaining = target_csize - len(stream)
    if remaining < 5:
        print(f"[ERROR] Stream terkompresi terlalu besar ({len(stream)} > {target_csize - 5})!")
        sys.exit(1)

    payload_len = remaining - 5
    comment_payload = b'/*' + b' ' * (payload_len - 4) + b'*/'
    header = struct.pack('<BHH', 0x01, payload_len, (~payload_len) & 0xFFFF)
    stored_block = header + comment_payload
    final_compressed = stream + stored_block
    assert len(final_compressed) == target_csize

    decomp = zlib.decompress(final_compressed, -zlib.MAX_WBITS)
    new_crc = zlib.crc32(decomp)
    new_usize = len(decomp)

    # Update Local Header at 183505679
    local_pos = 183505679
    assert data[local_pos:local_pos + 4] == b'PK\x03\x04', 'Local signature invalid'
    struct.pack_into('<I', data, local_pos + 14, new_crc)
    struct.pack_into('<I', data, local_pos + 22, new_usize)

    payload_start = local_pos + 37
    assert data[payload_start - 7:payload_start] == b'main.js', 'Filename mismatch'
    data[payload_start:payload_start + target_csize] = final_compressed

    # Update CD Header at 187685536
    cd_pos = 187685536
    assert data[cd_pos:cd_pos + 4] == b'PK\x01\x02', 'CD signature invalid'
    struct.pack_into('<I', data, cd_pos + 16, new_crc)
    struct.pack_into('<I', data, cd_pos + 24, new_usize)

    # Validasi zip
    verify_zip = bytes(data[zip_start:eocd_pos + 22])
    zv = zipfile.ZipFile(io.BytesIO(verify_zip))
    assert zv.testzip() is None, 'Uji integritas zip gagal!'
    assert zv.read('main.js') == decomp, 'Ekstraksi zip mismatch!'
    assert len(data) == 210725528, 'Ukuran file berubah!'

    # Tulis binary
    with open(AGY_PATH, 'wb') as f:
        f.write(data)

    print(f"\n🎉 SUKSES! agy.exe berhasil dipatch secara sempurna ({os.path.getsize(AGY_PATH):,} bytes).")
    print("Tata letak baru: [icon folder] [....] [full path rata kiri] [space 25%]")
    print("Silakan restart Antigravity IDE untuk melihat perubahannya!")

if __name__ == '__main__':
    apply_patch()
