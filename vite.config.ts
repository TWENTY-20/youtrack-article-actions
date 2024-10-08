import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    if (mode === "backend") {
        return {
            build: {
                lib: {
                    entry: "./src/backend.ts",
                    name: "backend",
                    fileName: "backend.ts"
                },
                rollupOptions: {
                    output: {
                        entryFileNames: "backend.js",
                        dir: "build"
                    }
                }
            }
        };
    }

    return {
        root: "src/widgets",
        plugins: [react(), viteStaticCopy({
            targets: [
                { src: "../../src/icons/*.*", dest: ".." },
                { src: "../../src/manifest.json", dest: ".." },
                { src: "../../src/settings.json", dest: ".." },
            ]
        })],
        build: {
            outDir: "../../build/widgets",
            assetsDir: "",
            assetsInlineLimit: 0,
            emptyOutDir: true,
            sourcemap: false, // enable for debugging purposes
            rollupOptions: {
                output: {
                    entryFileNames: "[name].js",
                    chunkFileNames: "[name].js",
                    assetFileNames: "[name].[ext]"
                }
            }
        },
        esbuild: {
            supported: {
                "top-level-await": true
            }
        },
    };
});
