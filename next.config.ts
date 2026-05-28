import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore: newly added by Next.js in warning
  allowedDevOrigins: ['192.168.5.110'],
};

export default nextConfig;
