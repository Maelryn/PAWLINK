import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // report and listing photos uploaded through the API are stored on Cloudinary
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
