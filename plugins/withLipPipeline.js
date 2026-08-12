/**
 * Config plugin — meng-injeksi pipeline lip-reading ke project Android
 * setiap kali `expo prebuild` dijalankan. Sumber kanonik ada di src/native/,
 * jadi kustom native code tidak akan hilang saat prebuild --clear.
 *
 * Yang dilakukan:
 *  1. Salin 8 file Kotlin dari src/native/frameprocessor/ →
 *     android/app/src/main/java/com/silentvoice/frameprocessor/
 *  2. Salin face_landmarker.task dari src/native/assets/ →
 *     android/app/src/main/assets/
 *  3. Tambahkan dependency MediaPipe ke android/app/build.gradle
 *  4. Daftarkan LipPipelinePackage() di MainApplication.kt
 *  5. Set org.gradle.java.home di android/gradle.properties ke JDK 21
 *     (agar build memakai JDK 21 bukan JDK 25 sistem; file ini ikut
 *     ter-regenerate tiap prebuild sehingga harus di-injeksi ulang)
 *
 * CATATAN API (terverifikasi dari @expo/config-plugins yang terpasang):
 *  withDangerousMod(config, [platform, action]) — parameter kedua adalah
 *  ARRAY [platform:string, action:function]. Action menerima
 *  ({ modRequest, modResults, ...config }) dan harus return config.
 */
const fs = require('fs');
const path = require('path');
const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const KOTLIN_SRC_REL = ['src', 'native', 'frameprocessor'];
const MODEL_SRC_REL = ['src', 'native', 'assets', 'face_landmarker.task'];
const MEDIAPIPE_DEP = '    implementation("com.google.mediapipe:tasks-vision:0.10.21")\n';

function withGradleWrapperDurable(config) {
  return withDangerousMod(config, ['android', (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    const wrapperPath = path.join(projectRoot, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties');
    const content = fs.readFileSync(wrapperPath, 'utf-8');

    // AGP 8.12.0 butuh Gradle >= 8.13; onnxruntime-react-native butuh
    // org.gradle.util.VersionNumber yang dihapus di Gradle 9.
    // Selalu pin ke 8.14 (prebuild --clear mereset wrapper ke 9.3.1 tiap kali).
    if (!content.includes('gradle-8.14-bin.zip')) {
      const fixed = content.replace(
        /distributionUrl=.*gradle-\d+(?:\.\d+)*-bin\.zip/,
        'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14-bin.zip'
      );
      fs.writeFileSync(wrapperPath, fixed, 'utf-8');
      console.log('[withLipPipeline] Wrapper Gradle di-pin ke 8.14 (durable)');
    } else {
      console.log('[withLipPipeline] Wrapper Gradle sudah 8.14');
    }
    return cfg;
  }]);
}

function withKotlinAndAssets(config) {
  return withDangerousMod(config, ['android', (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;

    // 1. Salin file Kotlin
    const srcDir = path.join(projectRoot, ...KOTLIN_SRC_REL);
    const destDir = path.join(
      projectRoot,
      'android', 'app', 'src', 'main', 'java',
      'com', 'silentvoice', 'frameprocessor'
    );
    if (!fs.existsSync(srcDir)) {
      throw new Error('[withLipPipeline] Folder Kotlin tidak ditemukan: ' + srcDir);
    }
    fs.mkdirSync(destDir, { recursive: true });
    let copied = 0;
    for (const file of fs.readdirSync(srcDir)) {
      if (file.endsWith('.kt')) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        copied++;
      }
    }
    console.log(`[withLipPipeline] ${copied} file Kotlin disalin ke android/`);

    // 2. Salin model MediaPipe
    const modelSrc = path.join(projectRoot, ...MODEL_SRC_REL);
    if (fs.existsSync(modelSrc)) {
      const assetsDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.copyFileSync(modelSrc, path.join(assetsDir, 'face_landmarker.task'));
      console.log('[withLipPipeline] face_landmarker.task disalin ke assets/');
    } else {
      console.warn('[withLipPipeline] PERINGATAN: face_landmarker.task tidak ada di ' + modelSrc);
    }

    return cfg;
  }]);
}

function withMediaPipeGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (contents.includes('tasks-vision')) return cfg;

    // Sisipkan setelah dependency react-android (baris pertama di blok dependencies)
    const marker = 'implementation("com.facebook.react:react-android")';
    const idx = contents.indexOf(marker);
    if (idx !== -1) {
      const insertAt = idx + marker.length;
      cfg.modResults.contents =
        contents.slice(0, insertAt) + '\n' + MEDIAPIPE_DEP + contents.slice(insertAt);
      console.log('[withLipPipeline] Dependency MediaPipe ditambahkan ke build.gradle');
    } else {
      const depsIdx = contents.indexOf('dependencies {');
      if (depsIdx !== -1) {
        const insertAt = depsIdx + 'dependencies {'.length;
        cfg.modResults.contents =
          contents.slice(0, insertAt) + '\n' + MEDIAPIPE_DEP + contents.slice(insertAt);
        console.log('[withLipPipeline] Dependency MediaPipe ditambahkan (fallback)');
      }
    }
    return cfg;
  });
}

// Versi CameraX yang dipakai vision-camera 4.7.3 sendiri (dari source node_modules).
// Menggunakan SATU versi konsisten untuk semua modul CameraX agar tidak ada
// konflik versi ganda yang menimbulkan NoClassDefFoundError: Camera2CameraInfoImpl
// & enumerasi kamera gagal (versi campuran). Force SEMUA 6 modul CameraX ke
// satu versi konsisten — vision-camera 4.7.3 menarik 6 modul ini semua.
const CAMERAX_VERSION = '1.5.0-alpha03';
const CAMERAX_MODULES = [
  'camera-core',
  'camera-camera2',
  'camera-lifecycle',
  'camera-video',
  'camera-view',
  'camera-extensions',
];
const CAMERAX_DEPS = CAMERAX_MODULES
  .map((m) => `    implementation "androidx.camera:${m}:${CAMERAX_VERSION}"`)
  .join('\n');
const CAMERAX_FORCE = CAMERAX_MODULES
  .map((m) => `            force "androidx.camera:${m}:${CAMERAX_VERSION}"`)
  .join('\n');

function withCameraXGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (contents.includes('androidx.camera:camera-core')) return cfg;

    // dependency CameraX versi 1.5.0-alpha03 (punya Camera2CameraInfoImpl).
    const deps = CAMERAX_DEPS;

    // PAKSA resolver: walau ada dep lain yang menarik versi lebih tinggi (1.6.0),
    // util.version yang dibutuhkan vision-camera 4.7.3 harus menang.
    // (Tanpa force, Gradle memilih versi tertinggi = 1.6.0 yang TIDAK punya
    //  Camera2CameraInfoImpl → NoClassDefFoundError saat runtime.)
    const forceBlock = [
      '    configurations.all {',
      '        resolutionStrategy {',
      CAMERAX_FORCE,
      '        }',
      '    }',
    ].join('\n');

    // 1) Sisipkan deps setelah react-android
    const marker = 'implementation("com.facebook.react:react-android")';
    const idx = contents.indexOf(marker);
    const insertDeps = '\n' + deps + '\n';
    let out = contents;
    if (idx !== -1) {
      const at = idx + marker.length;
      out = out.slice(0, at) + insertDeps + out.slice(at);
    } else {
      const di = out.indexOf('dependencies {');
      if (di !== -1) {
        const at = di + 'dependencies {'.length;
        out = out.slice(0, at) + insertDeps + out.slice(at);
      }
    }

    // 2) Sisipkan force-block di blok android/app (sebelum dependencies{) jika ada
    if (!out.includes('resolutionStrategy.force')) {
      // Letakkan forceBlock di luar dependencies — biasanya sebelum "dependencies {",
      // di area android{} ; paling aman: setelah baris "apply plugin:" terakhir.
      // Cek posisi "dependencies {" untuk menyisip tepat di atasnya.
      const dIdx = out.indexOf('dependencies {');
      if (dIdx !== -1) {
        const at = dIdx;
        out = out.slice(0, at) + forceBlock + '\n\n' + out.slice(at);
      }
    }

    cfg.modResults.contents = out;
    console.log(`[withLipPipeline] CameraX ${CAMERAX_VERSION} ditambahkan + forced via resolutionStrategy`);
    return cfg;
  });
}

function withOnnxRuntimePackage(config) {
  return withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes('OnnxruntimePackage')) return cfg;

    // Tambah import setelah import LipPipelinePackage (atau import terakhir)
    if (contents.includes('import com.silentvoice.frameprocessor.LipPipelinePackage')) {
      contents = contents.replace(
        'import com.silentvoice.frameprocessor.LipPipelinePackage',
        'import com.silentvoice.frameprocessor.LipPipelinePackage\nimport ai.onnxruntime.reactnative.OnnxruntimePackage'
      );
    } else {
      const importMarker = 'import expo.modules.ExpoReactHostFactory';
      if (contents.includes(importMarker)) {
        contents = contents.replace(
          importMarker,
          importMarker + '\nimport ai.onnxruntime.reactnative.OnnxruntimePackage'
        );
      }
    }

    // Daftarkan di packageList (setelah add(LipPipelinePackage()))
    if (contents.includes('add(LipPipelinePackage())')) {
      contents = contents.replace(
        'add(LipPipelinePackage())',
        'add(LipPipelinePackage())\n          add(OnnxruntimePackage())'
      );
    } else if (contents.includes('packages.apply {')) {
      contents = contents.replace(
        'packages.apply {',
        'packages.apply {\n          add(OnnxruntimePackage())'
      );
    }

    cfg.modResults.contents = contents;
    console.log('[withLipPipeline] OnnxruntimePackage didaftarkan di MainApplication (durable)');
    return cfg;
  });
}

function withMainApplicationPackage(config) {
  return withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes('LipPipelinePackage')) return cfg;

    // Tambah import setelah import expo terakhir
    const importMarker = 'import expo.modules.ExpoReactHostFactory';
    if (contents.includes(importMarker)) {
      contents = contents.replace(
        importMarker,
        importMarker + '\nimport com.silentvoice.frameprocessor.LipPipelinePackage'
      );
    } else {
      const lines = contents.split('\n');
      let lastImport = -1;
      lines.forEach((l, i) => { if (l.trim().startsWith('import ')) lastImport = i; });
      if (lastImport !== -1) {
        lines.splice(lastImport + 1, 0, 'import com.silentvoice.frameprocessor.LipPipelinePackage');
        contents = lines.join('\n');
      }
    }

    // Daftarkan di packageList
    if (contents.includes('// add(MyReactNativePackage())')) {
      contents = contents.replace('// add(MyReactNativePackage())', 'add(LipPipelinePackage())');
    } else if (contents.includes('packages.apply {')) {
      contents = contents.replace(
        'packages.apply {',
        'packages.apply {\n          add(LipPipelinePackage())'
      );
    }

    cfg.modResults.contents = contents;
    console.log('[withLipPipeline] LipPipelinePackage didaftarkan di MainApplication');
    return cfg;
  });
}

module.exports = function withLipPipeline(config) {
  config = withGradleWrapperDurable(config);
  config = withCameraXGradle(config);
  config = withKotlinAndAssets(config);
  config = withMediaPipeGradle(config);
  config = withOnnxRuntimePackage(config);
  config = withMainApplicationPackage(config);
  return config;
};
