import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Sui Money · Make room for what’s next',description:'Understand your native-USDC spending and plan the money already in your Sui wallet.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
