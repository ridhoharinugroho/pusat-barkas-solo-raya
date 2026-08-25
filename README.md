# solosatset - Pusat Jual Beli Solo Raya 🛍️✨

Platform marketplace web barang skala regional berbasis komunitas terpercaya untuk **7 wilayah Solo Raya**:
- Kota Surakarta (Solo)
- Kabupaten Karanganyar
- Kabupaten Sukoharjo
- Kabupaten Wonogiri
- Kabupaten Sragen
- Kabupaten Boyolali
- Kabupaten Klaten

---

## 🌟 Fitur Utama

1. **Katalog Produk & Filter 7 Wilayah Solo Raya**:
   - Filter cepat berdasarkan wilayah kabupaten/kota dan kecamatan.
   - Filter berdasarkan kategori barang (*Elektronik, Kendaraan, Perabot, Pakaian, Hobi, Alat Usaha, dll.*).
   - Filter rentang harga dan kondisi barang (*Like New, Mulus, Wajar Pemakaian, Butuh Servis*).
   - Pengurutan berdasarkan harga termurah/termahal, waktu unggah terbaru, dan paling banyak dilihat.

2. **Hubungi Penjual Langsung via WhatsApp (Instant CTA)**:
   - Integrasi langsung ke WhatsApp penjual dengan pesan terformat otomatis (*Judul barang, harga, jenis nego, lokasi wilayah/kecamatan, rekomendasi titik COD, dan nama calon pembeli*).

3. **Sistem Autentikasi Google Login**:
   - Masuk cepat menggunakan akun Google.
   - Pengaturan wajib *Nama Akun / Nama Tampilan Publik (Display Name)* dan nomor WhatsApp yang otomatis tertera di setiap iklan.

4. **Kelola Iklan Saya**:
   - Penjual dapat menandai status barang (*Tersedia / Terjual*) atau menghapus iklan miliknya secara mandiri.

5. **Panel Admin Terproteksi & Moderasi Produk**:
   - Login terproteksi khusus (**Username**: `ratakanan`, **Password**: `280995`).
   - Moderasi iklan (*Sembunyikan/Tampilkan ke publik, Tandai Terjual, Hapus Permanen*).
   - Statistik real-time iklan aktif, disembunyikan, dan terjual.

6. **Hidden Admin Trigger (5x Klik Logo)**:
   - Tombol admin tersembunyi dari publik.
   - Buka akses admin dengan melakukan klik/tap 5 kali berturut-turut pada logo di pojok kiri atas.

7. **Global Text Editor & Pengaturan Tampilan Real-Time**:
   - Ubah teks apa pun pada aplikasi dari panel admin tanpa terkecuali.
   - Pilihan jenis font (*Sans-Serif, Poppins, Serif, Monospace*).
   - Pilihan susunan tata letak (*Grid Responsif 2-4 Kolom* vs *Daftar Memanjang / List View*).
   - Banner pengumuman situs dinamis.
   - Tersimpan permanen ke database lokal dan tersinkronisasi instan antar peramban.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini dibangun menggunakan HTML5, Tailwind CSS, Lucide Icons, dan Modern Vanilla JavaScript (ES Modules).

### Menggunakan PowerShell Local Server:
```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```
Buka peramban di: `http://localhost:5500`

---

## 📁 Struktur Direktori
```text
solosatset/
├── index.html              # Halaman Utama Marketplace Publik
├── admin.html              # Panel Admin Terproteksi (Hidden Trigger)
├── server.ps1              # Local Web Server
├── README.md               # Dokumentasi Proyek
├── .gitignore              # Konfigurasi Git Ignore
├── css/
│   └── styles.css          # Styling kustom & Google Fonts
└── js/
    ├── app.js              # Controller Utama Aplikasi Publik
    ├── admin.js            # Controller Panel Admin & Text Editor
    ├── data/
    │   ├── regions.js      # Data 7 Wilayah & Kecamatan Solo Raya
    │   ├── categories.js   # Data Kategori, Kondisi & Nego
    │   └── sampleListings.js # Data Awal Contoh Iklan Barang
    └── services/
        ├── auth.js         # Google Auth & Display Name Manager
        ├── storage.js      # Database Storage & Site Settings
        └── whatsapp.js     # Generator Pesan & Format WhatsApp
```

---

## 📜 Lisensi
MIT License © 2026 solosatset - Pusat Jual Beli Solo Raya.

