# AG Title Full Path Helper

Helper utility dan dokumentasi untuk memodifikasi **Antigravity IDE** agar menampilkan **Full File System Path** pada setiap item percakapan di sidebar.

---

## 📸 Preview

### Sebelum (Default Stock)
Nama project terpotong, hanya menampilkan folder name (*basename*), rata kiri:
![Before](.docs/assets/before.jpg)

### Sesudah (Dengan Patch)
Menampilkan Full Path disk absolut, tata letak **RATA KIRI**, truncate dari kiri ke kanan (`direction: rtl; text-align: left`), menyisakan ruang bernapas 25% di sebelah kanan (`max-width: 75%`), ikon folder `📁`, dan tooltip hover path lengkap:
![After](.docs/assets/after.png)

Urutan visual:
```
pembatas kiri -> | [icon folder] [....] [full path rata kiri] [space 25% dari lebar baris] | <- Pembatas kanan
```

---

## ⚡ Cara Cepat Menggunakan (Quick Start)

### 1. Menerapkan Patch
Tutup aplikasi Antigravity IDE, lalu jalankan perintah berikut di terminal:
```bash
node apply_patch.js
```
*(Atau `python patch_agy.py`)*

Buka kembali Antigravity IDE. Seluruh project di sidebar akan langsung memuat full disk path dengan layout Rata Kiri + ruang bernapas 25%.

### 2. Mengembalikan ke Tampilan Bawaan (Rollback)
Jika ingin kembali ke tampilan original default bawaan:
```bash
node restore_backup.js
```

---

## 📚 Dokumentasi Lengkap
Pelajari arsitektur internal, analisis kode sumber Electron, fungsi `bun` & `ea`, patch binary `agy.exe`, serta bypass validasi checksum pada:
👉 [**Indeks Dokumentasi Teknis (.docs/README.md)**](.docs/README.md)

---

Dikembangkan dengan ❤️ oleh [ADR Programming](https://www.instagram.com/adr_programming/)

