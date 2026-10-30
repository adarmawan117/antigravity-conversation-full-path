# Sistem Integritas, Checksum (`product.json`), & Validasi Binary (`agy.exe`)

Dokumen ini menjelaskan mekanisme pengamanan integritas file pada Visual Studio Code / Antigravity IDE serta validasi binary ZIP internal pada `agy.exe`.

---

## 🛡️ 1. Cara Kerja Verifikasi Integritas VS Code (`product.json`)

VS Code memiliki sistem bawaan untuk mendeteksi apakah file instalasi telah diubah atau dirusak oleh pihak ketiga. Mekanisme ini bekerja melalui:

1. **File `resources/app/product.json`**:
   File ini memuat kamus (*dictionary*) checksum untuk file-file kunci:
   ```json
   {
     "checksums": {
       "vs/base/parts/sandbox/electron-browser/preload.js": "...",
       "vs/workbench/workbench.desktop.main.js": "/hlG4ZCgctRw06TgCOS1DW9nAxFOvlYW0m9yxHGnmO8",
       "vs/workbench/workbench.desktop.main.css": "...",
       "jetskiAgent/main.js": "ceb2s6qAD1Q137pK1o8zzLZI5eohF22fmPaiJG16lSU"
     }
   }
   ```
2. **Saat Aplikasi Dimulai (*Startup Validation*)**:
   - Proses Electron menghitung hash SHA-256 dari setiap file yang terdaftar di `product.json`.
   - Jika hash yang dihitung di disk **tidak cocok** dengan nilai yang tertulis di `product.json`, VS Code menandai instalasi sebagai `corrupt` / `unsupported`.
   - Muncul dialog modal peringatan:
     > *"Your Antigravity IDE installation appears to be corrupt. Please reinstall."*
   - Judul jendela (*title bar*) ditambahi teks `[Unsupported]`.

---

## 🧮 2. Spesifikasi Algoritma Checksum VS Code

Format hash yang digunakan oleh VS Code memiliki spesifikasi khusus:
1. **Algoritma**: `SHA-256` dari raw bytes file UTF-8.
2. **Encoding**: `Base64`.
3. **Aturan Padding**: Tanda sama dengan (`=`) di akhir string base64 **wajib dibuang** (*stripped*).

### Implementasi di Node.js:
```javascript
const crypto = require('crypto');
const fs = require('fs');

function calculateVsCodeChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto
    .createHash('sha256')
    .update(fileBuffer)
    .digest('base64')
    .replace(/=+$/, ''); // Hapus trailing padding '='
}
```

---

## 📦 3. Integritas Binary & Validasi CRC32 pada `agy.exe`

Berbeda dengan file JavaScript biasa di `resources/app/`, binary `agy.exe` (~210 MB) memuat arsip ZIP internal tanpa enkripsi yang melayani antarmuka sidebar secara real-time.

Untuk menjaga integritas binary dan mencegah kerusakan runtime Go:

1. **Struktur Header ZIP**:
   - **Local File Header**: Berada di offset byte `183,505,679`.
   - **Central Directory Header**: Berada di offset byte `187,685,536`.
   - **End of Central Directory (EOCD)**: Berada di offset byte `187,710,613`.

2. **Perhitungan CRC-32 Presisi**:
   Saat `main.js` dimodifikasi, nilai CRC-32 IEEE 802.3 dari file yang tidak terkompresi dihitung ulang:
   ```python
   new_crc = zlib.crc32(decompressed_bytes)
   new_usize = len(decompressed_bytes)
   ```
   Nilai ini dituliskan ke Local Header (offset +14) dan Central Directory Header (offset +16).

3. **Zero Size Drift (Menjaga Ukuran File Binary Tetap 210,725,528 Bytes)**:
   Ukuran file binary dan ukuran payload terkompresi tidak boleh bergeser 1 byte pun. File `main.js` terkompresi harus berukuran persis **3,271,174 bytes**.
   Sisa byte antara hasil kompresi raw DEFLATE dengan target 3,271,174 bytes diisi menggunakan sebuah **DEFLATE Stored Block (Uncompressed Block)** yang berisi komentar JavaScript:
   ```python
   payload_len = remaining - 5
   comment_payload = b'/*' + b' ' * (payload_len - 4) + b'*/'
   header = struct.pack('<BHH', 0x01, payload_len, (~payload_len) & 0xFFFF)
   stored_block = header + comment_payload
   ```

4. **Validasi Mandiri Sebelum Penyimpanan**:
   Sebelum binary ditulis ke disk, skrip Python memvalidasi seluruh arsip ZIP menggunakan modul `zipfile.ZipFile`:
   ```python
   z = zipfile.ZipFile(io.BytesIO(zip_bytes))
   assert z.testzip() is None, "ZIP integrity validation failed!"
   assert len(data) == 210725528, "Total file size mismatch!"
   ```
   Hal ini menjamin binary `agy.exe` stabil, aman, dan dieksekusi dengan sempurna oleh Windows OS.
