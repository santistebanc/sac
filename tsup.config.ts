import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        core: 'src/core.ts',
        calcs: 'src/calcs.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,        // keep modules separate for maximum tree-shaking
    treeshake: true,
    tsconfig: 'tsconfig.build.json',
})
