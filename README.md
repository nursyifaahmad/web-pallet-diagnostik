# PALLET · Personalised Art Learning Profile

Aplikasi Web Asesmen Diagnostik & Pembelajaran Berdiferensiasi Seni Rupa Fase D (SMP) berbasis Kurikulum Merdeka.

- **Domain Publik**: [https://artuniverse.my.id](https://artuniverse.my.id) (via Cloudflare Tunnel)
- **Port Internal**: `3090` (`http://localhost:3090`)
- **Hosting Server**: Docker Container di Mini PC (Storage: `/mnt/storage2/pallet/data`)
- **Repositori GitHub**: [https://github.com/nursyifaahmad/web-pallet-diagnostik.git](https://github.com/nursyifaahmad/web-pallet-diagnostik.git)

---

## 🎨 Karakteristik & Desain Antarmuka

Web ini dirancang dengan standar **Studio Atelier Aesthetic** (Bebas dari *AI Slop* / gradien neon ungu generik):
- Latar belakang kertas sketsa hangat (*Warm Paper / Alabaster* `#FAF8F5`).
- Aksen pigmen warna bumi: *Terracotta* (`#C2410C`), *Ultramarine* (`#1E1B4B`), dan *Ochre* (`#B45309`).
- Tipografi editorial berkelas: **Fraunces** (Serif Display), **Plus Jakarta Sans** (Body & Form), dan **JetBrains Mono** (Metrik & Kode Rombel).
- Kartu presisi taktil dengan bayangan natural dan ergonomi mobile-first yang sangat ramah bagi smartphone siswa SMP.

---

## 🚀 Pemisahan Portal Pengguna

1. **Portal Siswa (Root `/`)**:
   - Asesmen Diagnostik Mandiri tanpa login.
   - Pilihan kelas otomatis dari URL (`?class=VII-A`) atau menu dropdown 27 rombel.
   - Wizard kuesioner dinamis memuat soal langsung dari database.
   - Luaran instan berupa **Personalised Artist Profile Card** (kartu identitas seni siswa dengan avatar monogram, 3 badge profil, dan matriks 10 aspek).

2. **Portal Login Guru (`/login/guru`)**:
   - Halaman login khusus guru dengan enkripsi bcrypt dan session cookie JWT.
   - Akun default:
     - **Username**: `guru`
     - **Password**: `guru123`

3. **Dashboard Manajemen Guru (`/guru`)**:
   - **Roster 27 Rombel (VII-A s.d IX-I)**: Roster lengkap siswa, input kilat, filter gaya belajar.
   - **Heatmap Analisis Kelas**: Distribusi visual modalitas belajar, media 2D vs 3D, kendala berkarya, dan rekomendasi diferensiasi (Konten, Proses, Produk).
   - **Kelola Soal Diagnostik (CRUD)**: Guru leluasa menambah, mengubah, menghapus soal, atau reset ke 10 soal default.
   - **Generator Modul Ajar (Kurikulum Merdeka)**: RPP otomatis sesuai data riil rombel, siap cetak ke PDF atau disalin teksnya.
   - **Studio Tools**: Timer Praktik Studio 3-fase (Sketsa, Eksekusi, Apresiasi) & Generator Tim Heterogen.
   - **Rubrik Penilaian Autentik**: Penilaian ganda Proses (50%) + Produk (50%) dengan kalkulasi predikat otomatis.
   - **Kalender Akademik Seni**: Jadwal asesmen, praktik, dan pameran.
   - **Tautan & QR Code**: Pembagi link unik per rombel untuk WhatsApp grup.
   - **Ekspor Excel (.xlsx)**: Unduh seluruh data rombel dalam satu klik.

---

## 🛠️ Panduan Menjalankan di Server Mini PC

### 1. Struktur Direktori di Mini PC
Pastikan direktori storage di Mini PC sudah dibuat:
```bash
sudo mkdir -p /mnt/storage2/pallet/data
sudo chmod -R 775 /mnt/storage2/pallet
```

### 2. Clone Repositori
```bash
cd /mnt/storage2/pallet
git clone https://github.com/nursyifaahmad/web-pallet-diagnostik.git .
```

### 3. Jalankan Docker Compose
```bash
docker compose up -d --build
```
Aplikasi akan aktif dan melayani port `3090`. Database SQLite (`pallet.db`) akan otomatis dibuat dan tersimpan aman di `/mnt/storage2/pallet/data/pallet.db`.

---

## 🌐 Konfigurasi Cloudflare Tunnel

Pada dashboard Cloudflare Zero Trust / Cloudflare Tunnel yang sudah aktif di server Anda:
1. Pilih Tunnel aktif Anda.
2. Tambahkan / sesuaikan Public Hostname:
   - **Subdomain / Domain**: `artuniverse.my.id`
   - **Type**: `HTTP`
   - **URL**: `localhost:3090` (atau IP lokal Mini PC port `3090`)
3. Simpan perubahan. Web kini langsung live dan dapat diakses dengan HTTPS di [https://artuniverse.my.id](https://artuniverse.my.id).

---

## 🔄 Otomatisasi Git Push

Tersedia dua opsi sinkronisasi otomatis:

### Opsi A: Perintah Sekali Jalan (Terminal)
```bash
npm run push
```

### Opsi B: File Watcher Otomatis (PowerShell di Windows)
Jalankan file watcher di PowerShell:
```powershell
.\scripts\auto-git-push.ps1
```
Setiap kali Anda mengubah dan menyimpan file di proyek ini, watcher akan mendeteksi perubahan dan langsung menjalankan `git add`, `git commit`, dan `git push origin main` secara otomatis!
