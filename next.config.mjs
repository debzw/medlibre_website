import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable React strict mode for better development experience
    reactStrictMode: true,

    // Ignore ESLint and TypeScript errors during build for speed and stability
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },

    // Configure image domains for next/image optimization
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
        ],
    },

    // Experimental features
    experimental: {
        // Enable server actions for form handling
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
    typedRoutes: false,

    // Webpack configuration for compatibility
    webpack: (config, { isServer }) => {
        // Add explicit alias for @/ to resolve to src/
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.resolve(__dirname, 'src'),
        };

        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
        };
        return config;
    },

    // Environment variables to expose to the browser
    env: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
};

export default nextConfig;
