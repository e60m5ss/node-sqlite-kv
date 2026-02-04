import { defineConfig } from "tsdown";

export default defineConfig({
    format: ["esm", "cjs"],
    entry: ["src/index.ts"],
    skipNodeModulesBundle: true,
    removeNodeProtocol: false,
    minify: false,
    cjsDefault: true,
    clean: true,
    shims: true,
    dts: true,
    target: false,
});
