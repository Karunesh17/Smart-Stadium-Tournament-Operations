const path = require('path');
const apiUrl = process.env.API_URL || 'http://127.0.0.1:8000';

/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { externalDir: true },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
  webpack: (config) => {
    config.resolve.modules.push(path.resolve(__dirname, 'node_modules'));
    return config;
  },
};
