import typescript from 'rollup-plugin-typescript';

export default {
    entry: './src/main/index.ts',
    dest: './dist/ObjectMapper.js',
    format: 'cjs',
    sourceMap: true,
    external: [
        'reflect-metadata',
        'vitalink-constants'
    ],
    globals: {
        "reflect-metadata": "Reflect"
    },
    plugins: [
        typescript()
    ]
}