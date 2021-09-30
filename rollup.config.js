import pkg from './package.json';
import nodeResolve from '@rollup/plugin-node-resolve';
import vue from 'rollup-plugin-vue';

const components = {
  input: 'src/components/index.js',
  output: [
    {
      file: pkg.components,
      format: 'cjs',
      sourcemap: true
    },
  ],
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ],
  plugins: [
    nodeResolve({
      extensions: ['.ts', '.js'],
    }),
    vue()
  ]
};

export default [
  components
];
