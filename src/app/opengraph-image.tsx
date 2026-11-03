import { ImageResponse } from 'next/og';

// The preview card shown when a Sui Money link is shared: the mark, the name and what it does.
export const alt = 'Sui Money: send, receive and plan your USDC and SUI on Sui Mainnet';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80, background: '#f4f7ff', color: '#15243b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2863e8', color: '#ffffff', borderRadius: '22px 26px 26px 14px', fontSize: 72, fontWeight: 700, paddingBottom: 10 }}>s</div>
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, letterSpacing: -2 }}>sui money<span style={{ color: '#2863e8' }}>.</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>Your money. A clearer next step.</div>
        <div style={{ display: 'flex', fontSize: 34, color: '#53627a' }}>Send, receive and plan your USDC and SUI on Sui Mainnet.</div>
      </div>
    </div>,
    size,
  );
}
