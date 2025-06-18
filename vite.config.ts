import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/*
      See https://vitejs.dev/config/
*/

export default defineConfig(({ mode }) => {
    if (mode === "workflows") {
        return {
            plugins: [],
            build: {
                lib: {
                    entry: [
                        "./src/workflows/translations.ts",
                        "./src/workflows/backend.js",
                    ],
                    formats: ["cjs"],
                    fileName: (_format, entryName) => `${entryName}.js`
                },
                emptyOutDir: false,
            },
        };
    }

    return {
        root: "./src",
        plugins: [
            react(),
            tailwindcss(),
            viteStaticCopy({
                targets: [
                    { src: "../manifest.json", dest: "." },
                    { src: "settings.json", dest: "." },
                    { src: "entity-extensions.json", dest: "."},
                    { src: "icon.svg", dest: "." },
                ]
            }),
            viteStaticCopy({
                targets: [
                    // Widget icons and configurations
                    { src: "widgets/**/*.{svg,png,jpg,json}", dest: "." }
                ],
                structured: true
            })
        ],
        base: "",
        build: {
            outDir: "../dist",
            emptyOutDir: true,
            copyPublicDir: false,
            target: ["es2022"],
            assetsDir: "widgets/assets",
            sourcemap: true,
            rollupOptions: {
                input: {
                    // List every widget entry point here
                    issueMenuDemo: resolve(__dirname, 'src/widgets/issue-menu-demo/index.html'),
                }
            }
        }
    };
});
