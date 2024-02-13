import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  esbuildOptions(opts, { format }) {
    if (format === 'esm') {
      opts.banner = {
        js: 'import { createRequire as __createRequire } from "module";\n const require = __createRequire(import.meta.url);',
      };
    }
  },
});
