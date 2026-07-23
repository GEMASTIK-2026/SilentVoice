# 🤟 Silent Voice

<p align="center">
  <img src="./src/assets/images/LogoSV.webp" width="160" alt="Silent Voice Logo" />
</p>

<p align="center">
  <b>Aplikasi Penerjemah & Konversi Bahasa Isyarat Real-Time Berbasis Mobile</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-57.0.8-000000?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/React_Native-0.86.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NativeWind-v5-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="NativeWind" />
</p>

---

## 📌 Tentang Silent Voice

**Silent Voice** adalah aplikasi mobile inovatif yang dirancang untuk membantu menjembatani komunikasi antara **Teman Tuli** dan masyarakat luas. Aplikasi ini mengintegrasikan pemindaian kamera secara langsung (*live camera preview*) untuk mengonversi isyarat tangan menjadi output teks dan suara secara *real-time*.

> [!IMPORTANT]
> Proyek ini dikembangkan dengan **Expo SDK 57**, menggunakan **Expo Router** untuk navigasi *file-based*, serta **NativeWind** untuk *styling system* yang responsif dan modern.

---

## ✨ Fitur Utama

- 🎥 **Live Camera Viewfinder**: Fitur kamera interaktif dengan sudut bingkai *viewfinder* hijau untuk memandu posisi subjek.
- ⚡ **Kontrol Kamera Pintar**:
  - **Torch / Senter**: Kontrol senter LED belakang dengan logika pencegahan otomatis (*auto-disabled*) di kamera depan.
  - **Flip Camera**: Beralih kamera depan dan belakang dengan *smooth remounting*.
  - **Indikator Rekam**: Mode aktif perekaman dan pemrosesan bahasa isyarat.
- 👤 **Onboarding & Profil Pengguna**: Alur alur pengisian data awal (Nama, Usia, Jenis Kelamin) yang tersimpan secara lokal menggunakan `AsyncStorage`.
- 🏠 **Dashboard Utama (Home)**:
  - Ringkasan histori percakapan terakhir.
  - Informasi ketepatan konversi bahasa isyarat.
  - Pengaturan output suara.
- ❓ **Pusat Bantuan (Help Center)**:
  - Tab navigasi **FaQ**, **Kamus Bahasa Isyarat**, dan **History**.
  - Panduan penggunaan *gesture*, kalibrasi suara, dan pengaturan akun.
- 🛠️ **Dev-Friendly Mode**: Dilengkapi fitur **Logout DEV** (hanya muncul saat mode `__DEV__`) untuk memudahkan pengujian alur onboarding.

---

## 🛠️ Teknologi & Dependensi

| Teknologi / Modul | Deskripsi |
| :--- | :--- |
| **Expo SDK 57** | Core framework pengembangan mobile cross-platform |
| **React Native 0.86** | UI Engine utama aplikasi |
| **Expo Router v57** | Declarative file-based routing system (`src/app/`) |
| **NativeWind v5** | Tailwind CSS styling engine untuk React Native |
| **expo-camera** | Modul kamera native untuk preview dan kontrol hardware |
| **expo-symbols** | Cross-platform icon system (SF Symbols di iOS & Material Symbols di Android/Web) |
| **AsyncStorage** | Penyimpanan data lokal untuk profil dan status onboarding |
| **Reanimated & Font** | Animasi *splash screen* & kustomisasi font **Hanken Grotesk** |

---

## 📁 Struktur Direktori Proyek

```text
SilentVoice/
├── assets/                    # Aset statis awal projek
├── src/
│   ├── app/                   # Halaman utama (Expo Router file-based)
│   │   ├── _layout.tsx        # Root layout, penanganan Font & Splash Screen
│   │   ├── index.tsx          # Splash Screen animasi & Cek Onboarding
│   │   ├── onboarding.tsx     # Form pengisian profil pengguna
│   │   ├── home.tsx           # Dashboard utama aplikasi
│   │   ├── record.tsx         # Live Camera Preview & Konversi
│   │   └── help.tsx           # Pusat Bantuan, FaQ & Kamus
│   ├── assets/
│   │   ├── fonts/             # Font kustom Hanken Grotesk (Regular -> ExtraBold)
│   │   └── images/            # Logo & Gambar Background (.webp)
│   ├── components/            # Komponen UI reusable
│   │   ├── bottom-navigation-bar.tsx  # Navigation Bar Bawah
│   │   └── ui/               # Komponen UI tambahan
│   └── global.css             # Import Tailwind CSS & Deklarasi Font
├── app.json                   # Konfigurasi Expo & Plugin Izin Kamera
├── package.json               # Dependensi & script npm
└── tsconfig.json              # Konfigurasi TypeScript & Alias `@/*`
```

---

## 🚀 Panduan Memulai Development

### 1. Prasyarat
Pastikan Anda telah menginstal:
- [Node.js](https://nodejs.org/) (versi 18 LTS atau lebih baru)
- Aplikasi **Expo Go** di HP Anda (Android/iOS) atau Emulator.

### 2. Instalasi Dependensi
Jalankan perintah berikut di terminal:

```bash
npm install
```

### 3. Memulai Development Server
Jalankan perintah berikut untuk membuka Expo CLI:

```bash
npx expo start
```

Pilihan opsi eksekusi:
- **Android Emulator**: Tekan `a` pada terminal
- **iOS Simulator**: Tekan `i` pada terminal
- **Expo Go (Device Fisik)**: Scan QR Code yang muncul di terminal menggunakan aplikasi Expo Go / Kamera HP.

---

## 🧪 Perintah Pengujian

- **Type Checking (TypeScript)**:
  ```bash
  npx tsc --noEmit
  ```
- **Linting**:
  ```bash
  npm run lint
  ```

---

<p align="center">
  <sub>Dikembangkan dengan ❤️ untuk kemudahan komunikasi ramah disabilitas.</sub>
</p>
