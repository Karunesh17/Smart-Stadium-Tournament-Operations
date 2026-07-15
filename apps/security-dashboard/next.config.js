const apiUrl = process.env.API_URL || 'http://127.0.0.1:8000';

/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { externalDir: true },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};
