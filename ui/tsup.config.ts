import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  platform: 'browser',
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: [
    'react-markdown',
    'remark-gfm',
    'react-syntax-highlighter'
  ],
  external: ['react', 'react-dom', 'react-router-dom'],
  treeshake: true,
  minify: true,
  target: 'es2020',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  esbuildOptions(options) {
    options.jsx = 'automatic';
  }
});
