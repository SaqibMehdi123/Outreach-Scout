/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the production build's memory footprint small (low-RAM / shared envs).
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  // Type-checking is run separately via `tsc --noEmit`; ESLint is optional here.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
