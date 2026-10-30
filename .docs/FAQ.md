# Frequently Asked Questions (FAQ)

Kumpulan pertanyaan yang sering diajukan mengenai modifikasi full path pada Antigravity IDE.

---

### Q1: Apakah percakapan baru (*New Conversation*) akan langsung otomatis menampilkan full path?
**Jawab: Ya, 100% otomatis!**
Begitu Anda membuat percakapan baru di proyek yang sedang dibuka, fungsi `__getProjectFullPath` membaca state dari Redux store (`sidebarProjects` atau `trajectorySummaries`) dan menampilkan full path disk secara real-time tanpa jeda.

---

### Q2: Bagaimana jika saya membuka folder proyek yang benar-benar baru di disk (belum pernah dibuka sebelumnya)?
**Jawab: Tetap otomatis terbaca!**
Sistem ini membaca `folderUris` dan `workspaceUris` langsung dari Redux store aplikasi saat runtime. Jika nama proyek belum ada di database statis, helper resolver secara cerdas mendekode URI tersebut ke format Windows path (misal: `D:\Workspaces\Projects\MyNewApp`) dan menampilkannya seketika.

---

### Q3: Bagaimana tata letak baris path pada versi terbaru?
**Jawab: Rata Kiri dengan Ruang Bernapas 25%.**
Format tata letak yang diterapkan adalah:
```
pembatas kiri -> | [icon folder] [....] [full path rata kiri] [space 25% dari lebar baris] | <- Pembatas kanan
```
Path tidak lagi menempel ke tepi kanan, melainkan menempel rapi di sebelah kiri tepat di bawah judul percakapan, dengan batas lebar maksimal 75% baris (`max-width: 75%`).

---

### Q4: Mengapa pemotongan teks (*truncation*) dilakukan dari kiri (`...`)?
**Jawab:**
Path direktori Windows biasanya diawali dengan drive dan folder umum yang panjang (seperti `D:\Workspaces\Projects\MyCompany\...`). Bagian terpenting yang membedakan proyek satu dengan yang lain berada di ujung paling kanan (nama folder proyek, misalnya `\company-landing-page`). 
Dengan memotong elipsis di sebelah kiri (`...\company-landing-page`), nama folder proyek utama tetap utuh terbaca, sementara hover tooltip (`title`) tetap menampilkan 100% path absolut.

---

### Q5: Apa yang terjadi jika Antigravity IDE atau `agy.exe` melakukan update versi otomatis?
**Jawab:**
Jika aplikasi atau binary `agy.exe` diperbarui oleh Google/Antigravity, binary tersebut akan tertimpa oleh versi bawaan baru. 
Untuk mengaktifkan kembali full path, Anda cukup menjalankan perintah di root folder repository:
```bash
node apply_patch.js
```
*(Atau `python patch_agy.py`)*. Skrip akan memodifikasi binary baru secara otomatis dalam beberapa detik.

---

### Q6: Bagaimana cara mengembalikan ke kondisi bawaan pabrik (*Rollback*)?
**Jawab:**
Jalankan skrip rollback di terminal:
```bash
node restore_backup.js
```
Skrip ini akan memulihkan file cadangan `agy.exe.original` dan file JS original, menyinkronkan checksum `product.json`, serta membersihkan cache V8 secara bersih.
