import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rosewood-clam-5211.twil.io",
      },
    ],
  },
};

export default nextConfig;
