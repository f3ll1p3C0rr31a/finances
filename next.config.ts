import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // O App Router não roteia pastas iniciadas por ponto, e o Android exige
      // este caminho exato para validar o APK contra o domínio.
      { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" },
    ];
  },
};

export default nextConfig;
