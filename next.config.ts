import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:5328/api/:path*"
            : "/api/:path*",
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Add configuration for handling large files and binary downloads
  experimental: {
    largePageDataBytes: 128 * 1000, // 128KB
  },
  // Increase body parser limit for file uploads
  api: {
    bodyParser: {
      sizeLimit: '16mb',
    },
    responseLimit: false,
  },
};

export default nextConfig;
