import { ImageResponse } from 'next/og';

// The home-screen icon: the same blue "s" mark as the favicon, on a full square because iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2863e8', color: '#ffffff', fontSize: 132, fontWeight: 700, letterSpacing: -6, paddingBottom: 18 }}>s</div>,
    size,
  );
}
