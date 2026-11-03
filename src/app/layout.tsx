import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './theme.css';
import './theme-dark.css';
const bodyFont=localFont({src:'../../public/fonts/figtree.woff2',variable:'--font-body',weight:'300 900',display:'swap'});
const displayFont=localFont({src:'../../public/fonts/bricolage-grotesque.woff2',variable:'--font-display',weight:'200 800',display:'swap'});
// metadataBase makes the share-preview image an absolute link, which link previews require.
export const metadata:Metadata={metadataBase:new URL(process.env.APP_ORIGIN??'https://sui-money.vercel.app'),title:'Sui Money · Make room for what’s next',description:'Understand your native-USDC spending and plan the money already in your Sui wallet.'};
// Runs before first paint so the page never flashes the wrong theme: a saved choice wins, otherwise the system setting.
const themeScript=`try{var t=localStorage.getItem('sm-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" className={bodyFont.variable+' '+displayFont.variable} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>;}
