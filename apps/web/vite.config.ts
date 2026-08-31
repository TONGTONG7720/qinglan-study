import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => ({
  base: mode === "qa" ? "./" : "/",
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          maxSize: 250_000,
          groups: [
            {
              name: "course-features",
              test: /[\\/]features[\\/]course-materials[\\/]/u,
              maxSize: 250_000,
              priority: 20,
            },
            {
              name: "vendor",
              test: /[\\/]node_modules[\\/]/u,
              maxSize: 250_000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "#practice-demo-provider": fileURLToPath(
        new URL(
          mode === "production"
            ? "./src/features/course-materials/practice/practice-demo-provider.production.ts"
            : "./src/features/course-materials/practice/practice-demo-provider.dev.ts",
          import.meta.url,
        ),
      ),
      "#lesson-summary-provider": fileURLToPath(
        new URL(
          mode === "production"
            ? "./src/features/course-materials/lesson-summary/lesson-summary-provider.production.ts"
            : "./src/features/course-materials/lesson-summary/lesson-summary-provider.dev.ts",
          import.meta.url,
        ),
      ),
      "#lesson-complete-provider": fileURLToPath(
        new URL(
          mode === "production"
            ? "./src/features/course-materials/lesson-complete/lesson-complete-provider.production.ts"
            : "./src/features/course-materials/lesson-complete/lesson-complete-provider.dev.ts",
          import.meta.url,
        ),
      ),
      "#student-home-demo-provider": fileURLToPath(
        new URL(
          mode === "production"
            ? "./src/features/student-home/student-home-demo-provider.production.ts"
            : "./src/features/student-home/student-home-demo-provider.dev.ts",
          import.meta.url,
        ),
      ),
      "#task-detail-provider": fileURLToPath(
        new URL(
          mode === "production"
            ? "./src/features/student-home/task-detail/task-detail-provider.production.ts"
            : "./src/features/student-home/task-detail/task-detail-provider.dev.ts",
          import.meta.url,
        ),
      ),
      "#learning-plans-provider": fileURLToPath(
        new URL(
          mode === "production"
            ? "./src/features/student-home/learning-plans/learning-plans-provider.production.ts"
            : "./src/features/student-home/learning-plans/learning-plans-provider.dev.ts",
          import.meta.url,
        ),
      ),
      "#course-catalog-demo-provider": fileURLToPath(
        new URL(
          mode === "production"
            ? "./src/features/course-materials/course-catalog-demo-provider.production.ts"
            : "./src/features/course-materials/course-catalog-demo-provider.dev.ts",
          import.meta.url,
        ),
      ),
      "#knowledge-intro-provider": fileURLToPath(
        new URL(
          mode === "production"
            ? "./src/features/course-materials/knowledge-intro/knowledge-intro-provider.production.ts"
            : "./src/features/course-materials/knowledge-intro/knowledge-intro-provider.dev.ts",
          import.meta.url,
        ),
      ),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
}));
