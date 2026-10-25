import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Room for the organisers' CSV upload (see app/admin/import), which is capped at 2 MB itself.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
};

export default nextConfig;
