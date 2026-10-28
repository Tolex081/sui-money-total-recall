import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['@grpc/grpc-js','@protobuf-ts/grpc-transport','pg','@mysten-incubation/memwal'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: [
      {key:'X-Content-Type-Options',value:'nosniff'}, {key:'Referrer-Policy',value:'same-origin'},
      {key:'X-Frame-Options',value:'DENY'}, {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'"+(process.env.NODE_ENV==='development'?" 'unsafe-eval'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"},
    ]}];
  },
};
export default config;
