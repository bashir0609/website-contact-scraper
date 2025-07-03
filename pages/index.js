/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    REACT_APP_API_NINJAS_KEY: process.env.REACT_APP_API_NINJAS_KEY,
  },
  // Vercel specific optimizations
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
  },
}

module.exports = nextConfig
