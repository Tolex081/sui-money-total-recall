import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const bodyFont=localFont({src:'../../public/fonts/figtree.woff2',variable:'--font-body',weight:'300 900',display:'swap'});
const displayFont=localFont({src:'../../public/fonts/bricolage-grotesque.woff2',variable:'--font-display',weight:'200 800',display:'swap'});
export const metadata:Metadata={title:'Sui Money · Make room for what’s next',description:'Understand your native-USDC spending and plan the money already in your Sui wallet.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" className={bodyFont.variable+' '+displayFont.variable}><body>{children}</body></html>;}
