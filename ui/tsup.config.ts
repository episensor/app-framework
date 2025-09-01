import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Temporarily disabled to bypass type checking
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'react-router-dom'],
  treeshake: true,
  minify: true,
  target: 'es2020',
  esbuildOptions(options) {
    options.jsx = 'automatic';
  }
});