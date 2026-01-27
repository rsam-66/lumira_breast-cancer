# 🏥 Lumira (Analisis Kanker Payudara)

**Lumira** adalah platform analisis medis canggih yang dirancang untuk membantu dokter dalam deteksi dini kanker payudara menggunakan gambar USG (Ultrasound). Platform ini memanfaatkan pipeline AI Multi-Model yang canggih untuk memberikan validasi dan wawasan mendalam.

---

## 🚀 Gambaran Proyek

Aplikasi ini bertujuan untuk meningkatkan akurasi diagnosa kanker payudara dengan menyediakan "second opinion" berbasis AI kepada tenaga medis. Menggabungkan teknologi _Deep Learning_, analisis _Radiomics_, dan _Explainable AI (XAI)_ untuk transparansi diagnosa.

---

## ✨ Fitur Utama

### 1. 🛡️ Dashboard Admin

Pusat kontrol untuk administrator sistem.

- **Tinjauan Statistik**: Kartu real-time yang menampilkan Total Pasien, Dokter, Gambar yang Diunggah, dan Tinjauan Tertunda.
- **Manajemen Dokter**: Kemampuan CRUD (Buat, Baca, Perbarui, Hapus) lengkap untuk akun dokter.
- **Database Pasien**: Registri terpusat untuk semua rekam medis pasien.
- **Pencarian & Penyaringan**: Pencarian global berdasarkan metadata (Nama, ID, Email).
- **Log Aktivitas**: Melacak semua tindakan penting (misalnya, "Dokter X memperbarui Pasien Y") untuk keperluan audit.

### 2. 🩺 Dashboard Dokter

Area kerja utama bagi spesialis medis.

- **Manajemen Daftar Kerja**:
  - **Menunggu Tinjauan**: Prioritas kasus baru yang perlu diperiksa.
  - **Perlu Perhatian**: Kasus yang ditandai sebagai Ganas (Malignant) atau ditolak oleh sistem.
  - **Selesai**: Riwayat kasus yang telah divalidasi.
- **Konsol Tinjauan**:
  - **Tampilan Berdampingan**: Perbandingan gambar USG Asli vs Heatmap AI (GradCAM).
  - **Wawasan AI**: Menampilkan kelas prediksi (Jinak/Ganas/Normal) dan Skor Keyakinan (Confidence Score).
  - **Alat Anotasi**: Alat kuas (brush) manual bagi dokter untuk menandai ROI (Region of Interest).
  - **Validasi**: Dokter dapat "Setuju" (Isi otomatis) atau "Tidak Setuju" (Override manual) dengan hasil AI.

### 3. 🧠 Mesin Analisis AI (The Brain)

Pipeline kecerdasan buatan yang bekerja di balik layar.

- **Input**: Gambar USG (`.png`, `.jpg`).
- **Preprocessing**: Resize otomatis ke 224x224, CLAHE, dan Median Blurring.
- **Ekstraksi Fitur**: Menggabungkan Deep Learning (DenseNet121, DenseNet201, ResNet50), Radiomics, dan Analisis Frekuensi.
- **Klasifikasi**: Menggunakan LightGBM Classifier untuk memprediksi: **Benign (Jinak)**, **Malignant (Ganas)**, atau **Normal**.
- **XAI (Explainable AI)**: Integrasi **GradCAM** memvisualisasikan bagian gambar yang menjadi fokus model AI.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend**: Vue 3, Vite, Tailwind CSS
- **Backend**: Python (FastAPI) - _Untuk pemrosesan AI_
- **Database & Storage**: Supabase (Auth, Storage, Real-time DB)
- **Visualisasi**: Konva.js (Anotasi), Chart.js (Statistik)

---

## ⚙️ Instalasi dan Cara Menjalankan

Ikuti langkah-langkah berikut untuk menjalankan proyek ini di komputer lokal Anda.

### Prasyarat

- [Node.js](https://nodejs.org/) (Versi terbaru direkomendasikan)
- [Git](https://git-scm.com/)

### 1. Clone Repository

Buka terminal atau command prompt dan jalankan perintah berikut untuk mengunduh kode sumber:

```bash
git clone https://github.com/username/Front-End_BreastCancer.git
cd Front-End_BreastCancer
```

_(Catatan: Ganti URL di atas dengan URL repository Git yang sesuai jika berbeda)_

### 2. Instalasi Dependensi

Jalankan perintah berikut untuk menginstal semua pustaka yang diperlukan:

```bash
npm install
```

### 3. Konfigurasi Environment Variables

Anda perlu mengatur kredensial Supabase agar aplikasi dapat terhubung ke database.

1. Salin file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   # Atau di Windows Command Prompt:
   # copy .env.example .env
   ```
2. Buka file `.env` dan isi dengan URL dan Anon Key Supabase Anda:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Menjalankan Aplikasi

Untuk memulai server pengembangan lokal:

```bash
npm run dev
```

Akses aplikasi melalui browser di alamat yang muncul di terminal (biasanya `http://localhost:5173`).

---

## 👥 Akun Pengguna Demo

Gunakan kredensial berikut untuk masuk dan menguji aplikasi:

| Role       | Email                 | Password |
| ---------- | --------------------- | -------- |
| **Admin**  | admin@dev.com         | 123123   |
| **Doctor** | lumirahumic@gmail.com | 123123   |
