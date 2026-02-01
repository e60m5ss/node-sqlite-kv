import { defineConfig } from "tsup";

export default defineConfig({
    format: ["esm", "cjs"],
    entry: ["src/index.ts"],
    skipNodeModulesBundle: true,
    removeNodeProtocol: false,
    keepNames: true,
    minify: false,
    cjsInterop: true,
    clean: true,
    shims: true,
    silent: true,
    dts: true,
});
