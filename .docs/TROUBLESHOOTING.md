# Troubleshooting & Post-Mortem Analysis

Dokumen ini mendokumentasikan kendala teknis yang dihadapi selama proses investigasi, penyebab akar masalah (*root cause*), dan solusi definitifnya.

---

## 🛑 Problem 1: Penemuan Smoking Gun - Mengapa Modifikasi File di `resources/app/` Tidak Berefek pada Sidebar Aktif?

### Gejala:
Perubahan pada `jetskiAgent/main.js` maupun `workbench.desktop.main.js` sudah tersimpan dan checksum sudah cocok, namun saat Antigravity IDE dibuka, tampilan sidebar tetap tidak berubah sama sekali.

### Penyebab (*Root Cause*):
Melalui inspeksi mendalam menggunakan Chrome DevTools Protocol (CDP), ditemukan bahwa sidebar percakapan Antigravity yang menempel (*docked*) di dalam IDE sebenarnya berjalan di dalam sebuah **iframe** yang merujuk ke:
`http://127.0.0.1:<port>/c/<uuid>?extensionView=true&...`

Server yang melayani HTTP localhost tersebut adalah **`agy.exe`** (`C:\Users\<User>\.gemini\bin\agy.exe`), bukan web server Electron bawaan. Di dalam binary `agy.exe`, aset web frontend disimpan dalam arsip ZIP internal. Komponen sidebar (`Bpc` & `tb`) dieksekusi langsung dari file `main.js` di dalam ZIP tersebut.

### Solusi:
Terapkan patch biner langsung pada `C:\Users\<User>\.gemini\bin\agy.exe`:
1. Ekstraksi `main.js` dari embedded ZIP di `agy.exe`.
2. Terapkan modifikasi logika path dan styling JSX pada komponen `Bpc`.
3. Kompresi ulang menggunakan raw DEFLATE dengan sync flush dan sisipkan padding komentar DEFLATE stored block agar ukuran persis **3,271,174 bytes**.
4. Perbarui CRC32 dan uncompressed size pada Local File Header (offset `183505679`) dan Central Directory (offset `187685536`).
5. Jalankan skrip [patch_agy.py](../patch_agy.py).

---

## 🛑 Problem 2: Tampilan Path "Rata Kanan" Padahal Harus Rata Kiri dengan Ruang Bernapas 25%

### Gejala:
Path proyek muncul di sidebar tetapi menempel di sisi paling kanan baris (`justify-end`, `text-align: right`), dan path panjang memenuhi 100% baris tanpa menyisakan ruang bernapas.

### Penyebab (*Root Cause*):
Implementasi awal menggunakan utilitas Tailwind `justify-end`, `w-full`, dan CSS `text-align: right` dengan anggapan teks harus menempel di kanan dekat indikator waktu. Pengguna menginginkan path menempel di sebelah kiri tepat di bawah judul percakapan, dengan urutan:
```
pembatas kiri -> | [icon folder] [....] [full path rata kiri] [space 25% dari lebar baris] | <- Pembatas kanan
```

### Solusi:
Ubah styling kontainer dan teks pada elemen `tb` di komponen `Bpc`:
- **Kontainer Luar**:
  ```javascript
  className: Ni("flex items-center gap-1 min-w-0 text-left text-muted-foreground select-none", w ? "text-sm" : "text-xs"),
  style: {
    display: "flex",
    maxWidth: "75%",
    justifyContent: "flex-start",
    alignItems: "center",
    marginRight: "auto"
  }
  ```
- **Elemen Teks Truncate**:
  ```javascript
  className: "truncate",
  style: {
    direction: "rtl",
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flexShrink: 1
  }
  ```
- **Hasil**: Elemen menempel di kiri (`justify-start`), path panjang terpotong elipsis di sebelah kiri (`...\folder`), nama folder utama di ujung kanan tetap utuh, dan lebar maksimal 75% memastikan selalu ada 25% ruang bernapas di sisi kanan.

---

## 🛑 Problem 3: Port HTTP `agy.exe` Bersifat Dinamis

### Gejala:
Skrip otomasi atau pengujian yang menargetkan port statis (misal `http://127.0.0.1:3671`) gagal terhubung (`ECONNREFUSED`) pada peluncuran berikutnya.

### Penyebab (*Root Cause*):
`agy.exe` memilih port TCP bebas yang tersedia saat diluncurkan oleh Antigravity IDE (bisa 3671, 6445, 6631, dll.).

### Solusi:
Gunakan Chrome DevTools Protocol (CDP) pada port remote debugging IDE (`9222`) untuk menanyakan endpoint target yang aktif melalui `http://127.0.0.1:9222/json`. Cari target dengan mencocokkan pola URL:
`target.url && (target.url.includes('/c/') || target.url.includes('extensionView=true'))`

---

## 🛑 Problem 4: Layar Error *"Couldn't load this view"* (React Render Crash)

### Gejala:
Sidebar Antigravity berubah menjadi layar gelap dengan pesan *"Couldn't load this view"*.

### Penyebab (*Root Cause*):
Memanggil fungsi utilitas eksternal yang di-minifikasi secara berbeda atau bernilai `undefined`.

### Solusi:
Gunakan helper murni independen (*self-contained helper*) `__getProjectFullPath(name, convId)` yang aman dari error dengan pembungkus `try...catch` dan fallback string murni.

---

## 🛑 Problem 5: Dialog *"Your installation appears to be corrupt"*

### Gejala:
Muncul dialog error *"Your installation appears to be corrupt"* saat membuka Antigravity IDE.

### Penyebab (*Root Cause*):
File di dalam `resources/app/out/` berubah sehingga hash SHA-256 tidak lagi cocok dengan entri di `resources/app/product.json`.

### Solusi:
Hitung ulang hash SHA-256 base64 tanpa padding `=` dan perbarui `product.json` menggunakan skrip [apply_patch.js](../apply_patch.js).

---

## 🛑 Problem 6: Urutan Tanda Backslash `\` Windows Terbalik di RTL

### Gejala:
Path Windows menjadi `company-landing-page\Web:D\` saat mengaktifkan `direction: rtl`.

### Penyebab (*Root Cause*):
Algoritma BiDi (*Bidirectional*) menganggap tanda pemisah direktori `\` sebagai karakter netral sehingga dibalik urutan tampilannya.

### Solusi:
Bungkus teks path dengan Unicode Left-to-Right Mark:
`"\u200E" + _fp + "\u200E"`
Karakter ini menjaga arah pembacaan huruf dan tanda backslash tetap normal, sementara browser tetap menempatkan elipsis pemotongan teks di sisi kiri.
