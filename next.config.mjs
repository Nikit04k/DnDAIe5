/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_PUBLIC_EXPORT === 'true';

const nextConfig = {
  output: isExport ? 'export' : undefined,
  trailingSlash: isExport ? true : false,
  serverExternalPackages: ['msedge-tts', 'ws'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
