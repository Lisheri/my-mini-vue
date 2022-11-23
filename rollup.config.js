import typescript from "@rollup/plugin-typescript";
import path from 'path';

// 模块路径
const packagesDir = path.resolve(__dirname, 'packages');

// 获取构建路径
const resolve = p => path.resolve(path.resolve(packagesDir, 'vue'), p);

export default {
  input: resolve('./src/index.ts'),
  output: [
    // cjs -> commonjs
    // es module
    {
      format: 'cjs',
      file: resolve('lib/guide-mini-vue.cjs.js')
    },
    {
      format: 'esm',
      file: resolve('lib/guide-mini-vue.esm.js')
    }
  ],
  plugins: [typescript({
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    cacheDir: path.resolve(__dirname, 'node_modules/.rollupTS_cache'),
    compilerOptions: {
      sourceMap: true,
      declaration: true,
      declarationMap: true,
      outDir: 'lib/index.d.ts'
    },
    exclude: ['**/__tests__/*']
  })]
};