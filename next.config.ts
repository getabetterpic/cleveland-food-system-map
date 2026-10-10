import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Map is the home page for now. Temporary (307) so browsers don't cache it
  // if `/` gets its own page later.
  async redirects() {
    return [{ source: '/', destination: '/map', permanent: false }];
  },
};

export default nextConfig;
