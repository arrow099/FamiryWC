import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/data.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=30",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
