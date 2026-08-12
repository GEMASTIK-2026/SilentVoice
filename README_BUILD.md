# README BUILD — SilentVoice (Android APK)

Panduan lengkap untuk membangun APK Android dari project ini, termasuk cara
mengatasi setiap error yang sudah pernah ditemukan & dipecahkan selama
pengembangan (dokumentasi dari "pertempuran nyata", bukan teori).

---

## 1. Prasyarat (wajib sebelum build)

| Kebutuhan | Versi | Catatan |
|---|---|---|
| **Node.js** | ≥ 20 | Sudah termasuk toolchain Expo |
| **JDK** | **17 atau 21** (JANGAN 25!) | Android Gradle Plugin 8.12 butuh JDK 17/21. **JDK 25 → error `Unsupported class file major version 69`** |
| **Android SDK** | platform 36, build-tools 36.0.0 | Di-set lewat `local.properties` (sudah ada di repo, tapi path-nya perlu disesuaikan ke mesin Anda) |
| **Gradle** | **8.14** (sudah di-pin otomatis) | JANGAN 9.x — lihat bagian FAQ |

> **PENTING:** Semua versi sudah di-pin durable lewat config plugin
> (`plugins/withLipPipeline.js`) — `expo prebuild --clear` tidak akan bisa
> mengembalikannya ke versi bermasalah.

---

## 2. Langkah Build

```bash
# 1. Install dependencies (patch-package otomatis jalan lewat postinstall)
npm install

# 2. Generate folder android/ (injeksi semua native code otomatis)
npx expo prebuild --platform android

# 3. Pastikan ANDROID_HOME menunjuk SDK Anda (Windows)
#    (opsional, karena local.properties sudah ada — tapi pastikan path-nya benar)
setx ANDROID_HOME "C:\Users\<nama>\AppData\Local\Android\Sdk"

# 4. Build APK debug
cd android
gradlew.bat assembleDebug

# 5. Hasil APK
#    android/app/build/outputs/apk/debug/app-debug.apk
```

Untuk **APK release (produksi)**:
```bash
cd android
gradlew.bat assembleRelease
# Hasil: android/app/build/outputs/apk/release/app-release.apk
```

Atau pakai **EAS Build** (disarankan untuk distribusi produksi):
```bash
npx eas-cli build --platform android --profile production
```

---

## 3. Struktur Penting Project

| Path | Isi | Jangan Diubah? |
|---|---|---|
| `src/native/frameprocessor/` | **8 file Kotlin** pipeline lip-reading (SUMBER KANONIK) | ✅ Jangan diedit di `android/` — edit di sini, prebuild akan menyalinnya |
| `src/native/assets/face_landmarker.task` | Model MediaPipe (3.58 MB) | ✅ Wajib ada (di-copy ke android/assets tiap prebuild) |
| `assets/models/final_base_model.onnx` | Model ONNX lip-reading (6.37 MB) | ✅ Wajib ada (dibaca onnxruntime di runtime) |
| `plugins/withLipPipeline.js` | Config plugin: injeksi otomatis 5 hal ke `android/` | ✅ Edit di sini untuk ubah perilaku injeksi |
| `patches/react-native-vision-camera+4.7.3.patch` | Fix vision-camera utk RN 0.86 | ✅ Jangan hapus — patch-package terapkan otomatis |

### Apa yang di-injeksi `withLipPipeline.js` setiap prebuild:
1. 8 file Kotlin dari `src/native/frameprocessor/` → `android/.../com/silentvoice/frameprocessor/`
2. `face_landmarker.task` → `android/app/src/main/assets/`
3. **Wrapper Gradle di-pin ke 8.14** (cegah revert ke 9.3.1 yang bermasalah)
4. Dependency MediaPipe `tasks-vision` → `android/app/build.gradle`
5. `LipPipelinePackage()` terdaftar di `MainApplication.kt`

---

## 4. FAQ — Error yang Sudah Ditemukan & Dipecahkan

### ❌ `SDK location not found`
- **Penyebab:** `ANDROID_HOME` tidak terlihat oleh Gradle daemon.
- **Solusi:** buat `android/local.properties` berisi `sdk.dir=C:\\...\\Android\\Sdk` (sudah ada di repo — sesuaikan path ke mesin Anda).

### ❌ `Could not get unknown property 'VersionNumber'` (onnxruntime-react-native)
- **Penyebab:** Gradle 9 menghapus `org.gradle.util.VersionNumber` yang dipakai onnxruntime-react-native.
- **Solusi:** **Gradle 8.14** (sudah di-pin otomatis oleh plugin). JANGAN pakai Gradle 9.x.

### ❌ `Unsupported class file major version 69`
- **Penyebab:** JDK 25 dipakai Gradle.
- **Solusi:** pakai **JDK 17/21**. Set `org.gradle.java.home` di `~/.gradle/gradle.properties`:
  ```
  org.gradle.java.home=C:\Program Files\Java\jdk-21.0.12
  ```

### ❌ `SoftwareComponent with name 'release' not found` (project :expo)
- **Penyebab:** Efek berantai dari Gradle 9 vs AGP 8.12.
- **Solusi:** sama — **Gradle 8.14**.

### ❌ `Unresolved reference 'currentActivity'` (react-native-vision-camera)
- **Penyebab:** RN 0.86 menghapus property `currentActivity` di ReactContext.
- **Solusi:** sudah di-patch via `patches/...patch` (ganti ke `getCurrentActivity()`). Patch diterapkan otomatis oleh `postinstall: patch-package`.

### ❌ `Return type mismatch: expected MutableMap...` (vision-camera)
- **Penyebab:** ketidakcocokan tipe dengan RN 0.86.
- **Solusi:** sudah diperbaiki di **vision-camera 4.7.3** (upgrade dari 4.7.0).

### ❌ `expo prebuild --clear` menghapus native code custom
- **Penyebab:** prebuild regenerate folder `android/` dari nol.
- **Solusi:** SEMUA kustom native code sumbernya di `src/native/` + di-injeksi otomatis oleh `withLipPipeline.js` — tidak akan hilang lagi.

---

## 5. Arsitektur Pipeline (ringkas)

```
Camera (VisionCamera 4.7.3, Android)
   └─ Frame Processor Plugin (Kotlin, `src/native/frameprocessor/`)
        ├─ LipProcessing.kt      — normalisasi landmark, MAR, crop-align 96x96
        ├─ LipCaptureEngine.kt   — state machine: IDLE→WAITING→RECORDING→emit clip
        ├─ LipPrecompute.kt      — refine trim, 20 patch 10x10, resample 30 frame,
        │                          gray+diff, landmark 161 dims
        ├─ LipPipelineRunner.kt  — orkestrasi + kirim event ke JS
        ├─ LipPipelineModule.kt  — startSession()/stopSession() ke JS
        └─ FrameUtils.kt         — YUV→BGR
           ↓ (event onClipReady: visual_base64 + landmark_base64)
JS side:
   ├─ useCaptureEngine.ts  — queue FIFO, inference ONNX, hasil terurut
   ├─ preprocessingConfig.ts — konstanta preprocessing (sumber kebenaran)
   └─ record.tsx / kamus.tsx / kalibrasi.tsx — UI
```

**Alur kalibrasi (PART B):** halaman Kalibrasi menerima tensor hasil precompute
(visual+landmark) → simpan ke `documentDirectory/calibration/<kata>/<index>.json`
via `expo-file-system` + metadata ke AsyncStorage. Data ini nanti (Tahap 4)
di-upload ke cloud untuk fine-tuning personalisasi.

---

## 6. Catatan Khusus (penting!)

- **Jangan commit `android/`** — folder ini di-generate ulang oleh prebuild.
  Yang di-commit: `src/native/`, `plugins/`, `patches/`, `assets/models/`,
  `src/native/assets/`.
- **Jangan pakai Gradle 9.x** — pin tetap di 8.14 (otomatis oleh plugin).
- **Model wajib ada di repo** (`final_base_model.onnx` + `face_landmarker.task`)
  — tanpa keduanya, build EAS akan sukses tapi app crash saat runtime (model tidak ditemukan).
- VisionCamera **4.x** dipakai (bukan 5.x) karena API `FrameProcessorPlugin`
  yang menjadi dasar pipeline custom hanya tersedia di lini 4.x.
