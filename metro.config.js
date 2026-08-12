const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Tambahkan .onnx sebagai asset extension (dibutuhkan onnxruntime-react-native)
config.resolver.assetExts.push("onnx");

module.exports = withNativewind(config);
