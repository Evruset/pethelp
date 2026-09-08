import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.VETHELP_NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(process.cwd(), '../..'),
  },
};

export default nextConfig;
