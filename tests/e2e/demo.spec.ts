import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('public demo: core screens, learning comparison and honest proof',async({page})=>{
  await page.goto('/demo');await expect(page.getByRole('heading',{name:'A little clarity for today.'})).toBeVisible();
  await expect(page.getByText('Fictional finance data',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Why this changed'}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('134.00 USDC of future obligations',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Activity'}).click();
  await expect(page.getByRole('heading',{name:'Every payment has a story.'})).toBeVisible();
  await page.getByLabel('Search payment explanations').fill('shared');await expect(page.getByText('Shared grocery shop',{exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Plan',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Make room for what’s next.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Add commitment'})).toBeDisabled();
  await page.goto('/proof');await expect(page.getByText('VERIFICATION PENDING').first()).toBeVisible();
});
test('390px and 1440px have no horizontal page overflow, keyboard focus and accessible labels',async({page})=>{
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:950});
    for(const path of ['/','/demo','/demo/activity','/demo/plan','/demo/memories','/proof','/about']){
      await page.goto(path);await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    }
  }
  await page.goto('/demo');await page.keyboard.press('Tab');await expect(page.getByText('Skip to main content')).toBeFocused();
});
test('demo never accepts writes and every personal endpoint requires a session',async({request})=>{
  for(const path of ['/api/demo','/api/demo/state','/api/demo/memories']){const response=await request.post(path,{data:{}});expect(response.status()).toBe(405);}
  for(const path of ['/api/account','/api/state','/api/plan','/api/activity','/api/balances','/api/today','/api/memories','/api/memory-jobs/00000000-0000-0000-0000-000000000000','/api/export']){const response=await request.get(path);expect(response.status()).toBe(401);}
});
test('accessible demo has no serious/critical WCAG violations',async({page})=>{
  await page.goto('/demo');const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
});
