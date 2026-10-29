import { notFound } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import { appMode } from '@/lib/config';
const routes=['today','activity','plan','memories','proof','about','demo','demo/today','demo/activity','demo/plan','demo/memories','demo/learning'];
export default async function Page({params}:{params:Promise<{screen:string[]}>}){const {screen}=await params;const route=screen.join('/');if(!routes.includes(route))notFound();return <Dashboard key={route} route={route} mode={appMode()} walletSignInEnabled={process.env.WALLET_SIGNIN_ENABLED!=='false'}/>;}
