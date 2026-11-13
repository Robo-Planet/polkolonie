import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Czcionki do PDF muszą być w paczce serwerowej (funkcje Vercel).
  outputFileTracingIncludes: { "/zgloszenie/**": ["./lib/pdf/fonts/**"] },
  reactStrictMode: true,
  poweredByHeader: false,
  // Strony administratora i formularze zawierają dane o zdrowiu dzieci – nie indeksujemy.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
