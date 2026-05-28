#!/usr/bin/env node
require('esbuild').buildSync({
  entryPoints: ['server-lib/scoring.js'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'api/_scoring.cjs',
  external: [],
});
