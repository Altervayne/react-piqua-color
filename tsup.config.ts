import { defineConfig } from 'tsup'

export default defineConfig({
   // Entry points: the JS/TS barrel and the standalone stylesheet.
   entry: ['src/index.ts', 'src/styles.css'],
   format: ['esm', 'cjs'],
   dts: true,
   sourcemap: true,
   clean: true,
   // React is provided by the consuming app.
   external: ['react', 'react-dom', 'react/jsx-runtime'],
   outExtension({ format }) {
      return { js: format === 'cjs' ? '.cjs' : '.js' }
   },
})
