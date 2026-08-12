# Verifikasi Pipeline Crop Bibir di Device

Dokumen ini adalah panduan untuk memverifikasi hasil perbaikan pipeline
(precompute visual+landmark) di perangkat Android, setelah patch
`LipPipelineRunner.kt` (per-frame snapshot anti-race) dan sinkronisasi
`LipPrecompute.kt`/`LipProcessing.kt` dengan notebook acuan
`precompute-lcp-v7--Multimodal-v2.ipynb`.

## 1. Bangun & Pasang APK Debug

```bash
cd D:\claudeCode\SilentVoice\android
./gradlew :app:assembleDebug --console=plain
# lalu instal:
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> Pastikan `compileDebugKotlin` sukses (BUILD SUCCESSFUL) sebelum assemble.

## 2. Rekam Clip Baru (jalur debug aktif)

1. Buka aplikasi SilentVoice di perangkat.
2. Masuk ke layar **Rekam** (record).
3. Rekam minimal 1–2 clip dengan wajah menghadap kamera, bibir terlihat penuh,
   gerakan bibir jelas (berbicara), pencahayaan cukup.
4. Setiap clip menghasilkan folder baru di
   `Android/data/com.silentvoice/files/debug_clip/clip_<seq>/`
   (hanya pada build DEBUG).

## 3. Tarik Data Debug ke PC

```bash
adb pull /sdcard/Android/data/com.silentvoice/files/debug_clip D:\claudeCode\SilentVoice\clip_analysis_v36
```

> Buat folder baru (mis. `clip_analysis_v36`) agar tidak tercampur dengan hasil lama.

## 4. Cek yang Harus Diperbaiki

Periksa per clip baru:

| Masalah lama | Cara cek di data baru |
|---|---|
| Bibir terpotong kanan/kiri | Buka `clip_<n>/resample_*.png` (30 frame). Bibir harus utuh, tidak menyentuh tepi kanvas. |
| Bibir miring | Sudut bibir harus horizontal (tidak rotasi tajam). Di `clip_<n>/raw/landmarks_meta.txt` cek sudut mata ≈ 0° (deviasi kecil). |
| Landmark tidak nempel | Titik merah di `frame_*.png` harus berada persis di tepi bibir (kontur bibir). |
| Frame tanpa bibir | Semua frame di segmen harus memuat bibir (tidak ada frame hitam/kosong). |
| Orientasi konsisten | `clip_<n>/raw/meta.txt` harus konsisten antar clip: `w=` dan `h=` SAMA (mis. 640×480) untuk semua clip dari sesi rekam yang sama. |

## 5. Cek Log (race & orientasi)

```bash
adb logcat -s LipPipelineRunner | grep -E "RES ts|BGR ts"
```

- `RES ts` dan `BGR ts` yang berdekatan (delta kecil) = snapshot per-frame bekerja.
- Perhatikan `w= h= orient=` di `BGR ts`: semua klip dalam satu sesi harus
  berorientasi sama (mis. `orient=270` dengan hasil rotasi konsisten).

## 6. Verifikasi Visual Cepat (opsional)

Gunakan skrip Python kecil (lihat `clip_analysis_v35/` untuk contoh) untuk
menghitung bbox bibir dari `landmarks.bin`:
- Bibir harus dekat pusat frame (margin kiri/kanan seimbang, ±10%).
- Sudut mata (atan2(eye_vec)) harus dekat 0° (atau ±90° konsisten).

## 7. Jika Masih Ada Masalah

- **Bibir terpotong/miring** → cek orientasi & `cropAlignVisual` di
  `LipProcessing.kt` terhadap notebook (harus sudah persis).
- **Landmark tidak nempel** → cek race snapshot di `LipPipelineRunner.kt`
  (sudah diterapkan) dan pastikan landmark memakai koordinat frame yang sama
  dengan BGR.
- **Frame kosong** → cek deteksi wajah (wajah di luar frame), atau sesuaikan
  pencahayaan.

## Referensi

- Notebook acuan: `D:\claudeCode\precompute-lcp-v7--Multimodal-v2.ipynb`
- Pipeline Kotlin: `D:\claudeCode\SilentVoice\android\app\src\main\java\com\silentvoice\frameprocessor\`
