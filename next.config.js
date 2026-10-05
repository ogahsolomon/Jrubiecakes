/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Google account avatars (OAuth profile pictures)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/webp"],
    // A missing or mistyped photo must not surface as a broken-image icon.
    // Next's onError path in <ResilientImage> catches this instead.
    deviceSizes: [360, 420, 640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [44, 56, 64, 80, 96, 200, 384],
  },
  poweredByHeader: false,
};

module.exports = nextConfig;
