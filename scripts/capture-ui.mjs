import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL??'http://localhost:3100';
const browser=await chromium.launch({headless:true});
const checks=[];
const screens=[
  {path:'/',name:'landing'},
  {path:'/today',name:'today'},
  {path:'/demo',name:'demo'},
  {path:'/demo/activity',name:'demo-activity'},
  {path:'/demo/plan',name:'demo-plan'},
  {path:'/proof',name:'proof'},
];
await mkdir('evidence/screenshots',{recursive:true});
try{
  for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:1000}});
    for(const screen of screens){
      const response=await page.goto(base+screen.path);await page.locator('h1').waitFor();await page.waitForTimeout(500);
      await page.evaluate(()=>document.fonts.ready);
      if(screen.path==='/today')await page.locator('.connect-state:not([hidden])').waitFor({timeout:15000});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
      const file='evidence/screenshots/'+screen.name+'-'+width+'.png';
      await page.screenshot({path:file,fullPage:false});checks.push({screen:screen.path,width,status:response.status(),overflow,file});
    }
    await page.close();
  }
}finally{await browser.close();}
await writeFile('evidence/public/visual-checks.json',JSON.stringify({checkedAt:new Date().toISOString(),base,automatedCaptures:true,manualVisualReview:false,checks},null,2));
if(checks.some(c=>c.status!==200||c.overflow))process.exitCode=1;
