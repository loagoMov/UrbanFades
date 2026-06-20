import type { NextConfig } from 'next';

// Use the same timezone everywhere – fallback to Africa/Gaborone if not set
const TIME_ZONE = process.env.NEXT_PUBLIC_TIMEZONE || 'Africa/Gaborone';

const formatTime = (d: Date) => {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: TIME_ZONE // Use env‑driven timezone
  }).replace(/^0/, ''); // Clean leading zeros (e.g. 09:00 AM -> 9:00 AM)
};

const securityHeaders = [
  // Prevent the site from being embedded in iframes (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop browsers from MIME-sniffing the content type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't send the referrer to cross-origin destinations
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features we don't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Force HTTPS for 2 years, include sub-domains
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Basic XSS protection for older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
];

const nextConfig: NextConfig = {
  // Environment variables for consistent timezone handling
  env: {
    TZ: 'Africa/Gaborone',               // Node process timezone
    NEXT_PUBLIC_TIMEZONE: 'Africa/Gaborone' // Exposed to client side
  },
  // @ts-ignore: newly added by Next.js in warning
  allowedDevOrigins: ['192.168.5.110'],

  async headers() {
    return [
      {
        // Apply to every route
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
