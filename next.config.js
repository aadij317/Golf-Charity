/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Charity images live in Supabase Storage on a per-project subdomain
    // that isn't known until deploy time, so we allow the wildcard rather
    // than hardcoding one project's hostname here. Cards render with
    // `unoptimized` anyway (see charity-card.tsx) so this mainly guards
    // against a future switch back to next/image optimization.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

module.exports = nextConfig;
