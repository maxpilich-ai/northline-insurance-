import { chromium } from "playwright";
const BASE = process.argv[2] ?? 'http://127.0.0.1:4501';
/** Records written by tests/collector.mjs — one collector, one source of truth. */
import { readFileSync } from "node:fs";

/**
 * Records written by tests/collector.mjs.
 *
 * REQUIRED, NOT DEFAULTED (finding R3-L3). This used to fall back to a fixed
 * path in /tmp. Running a suite standalone — the invocation each file documents
 * in its own header — then silently validated whatever a previous run had left
 * behind: a 174-record file from nine hours earlier, built from different
 * source on a different port, produced seven confident failures that had
 * nothing to do with the code under test. Tests that are wrong for reasons
 * unrelated to the code get muted, and a muted test is worse than no test.
 * run-all.sh exports COLLECTOR_FILE; standalone runs must say which file they
 * mean.
 */
const RECORDS_FILE = process.env.COLLECTOR_FILE;
if (!RECORDS_FILE) {
  console.error(
    "\n  COLLECTOR_FILE is not set. This suite asserts on records the running\n" +
    "  server actually stored, so it must be told which collector file belongs\n" +
    "  to THIS run. Use `npm test`, or set COLLECTOR_FILE explicitly.\n"
  );
  process.exit(1);
}
const allRecords = () => { try { return JSON.parse(readFileSync(RECORDS_FILE, "utf8")); } catch { return []; } };
const settle = () => new Promise((r) => setTimeout(r, 250));
let pass = 0, fail = 0;
const ck = (n, ok, d = "") => {
  if (ok) { pass++; console.log("  PASS  " + n); }
  else { fail++; console.log("  FAIL  " + n + " " + d); }
};

const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:390,height:844}});
const page=await ctx.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

/* ── QUOTE WIZARD, full walk, mobile viewport ─────────────────────────── */
await page.goto(BASE+'/quote',{waitUntil:'load'});
await page.getByText('People depend on my income').click();
await page.getByRole('button',{name:/continue/i}).click();
await page.getByText('$500,000 – $1 million').click();
await page.getByRole('button',{name:/continue/i}).click();
await page.fill('#age','42');
await page.getByText('Female',{exact:true}).click();
await page.selectOption('#state','Minnesota');
await page.getByText('No',{exact:true}).click();
await page.getByRole('button',{name:/continue/i}).click();
await page.getByText('Good',{exact:true}).click();
await page.getByRole('button',{name:/continue/i}).click();
await page.waitForSelector('#consent');

// draft persistence: reload mid-wizard, then check the answers survive
const draftKeys = await page.evaluate(()=>Object.keys(sessionStorage));
ck('wizard writes a draft to sessionStorage', draftKeys.length>0, JSON.stringify(draftKeys));

// Wait for the draft to actually CONTAIN the answers before reloading. The save
// runs in an effect, so reloading the instant after a keystroke races it — and a
// race in the test would read as a broken feature.
await page.waitForFunction(
  () => (sessionStorage.getItem('quote-draft-v1') ?? '').includes('"age":"42"'),
  null, { timeout: 5000 }
);
await page.reload({waitUntil:'load'});
await page.waitForTimeout(400);
const afterReload = await page.evaluate(()=>({step:document.body.innerText.match(/Step (\d) of/)?.[1]??null, age:document.querySelector('#age')?.value??null}));
ck('draft restores after a reload', afterReload.step!=='1'||afterReload.age==='42', JSON.stringify(afterReload));

// finish the wizard from wherever the reload landed
if(!(await page.$('#consent'))){
  for(let i=0;i<6 && !(await page.$('#consent'));i++){
    const b=await page.$('button:has-text("Continue")'); if(!b) break; await b.click(); await page.waitForTimeout(150);
  }
}
await page.waitForSelector('#consent');
await page.fill('#name','Flow Test');
await page.fill('#email','flow@example.com');
await page.fill('#phone','9522327177');
await page.check('#consent');
await Promise.all([page.waitForURL(/thank-you\/quote/,{timeout:20000}), page.getByRole('button',{name:/send|submit|request/i}).click()]);
await settle();
ck('quote form lands on /thank-you/quote', page.url().includes('/thank-you/quote'));
ck('quote reached the store transport', allRecords().some(r=>r.kind==='quote'));
const q=allRecords().find(r=>r.kind==='quote');
ck('stored quote carries consumer consent', q?.consent?.version==='consumer-tcpa-v1');
ck('stored quote sourceUrl is the quote page', q?.consent?.sourceUrl?.endsWith('/quote')===true, q?.consent?.sourceUrl);
const cleared=await page.evaluate(()=>Object.keys(sessionStorage).length);
ck('draft cleared after successful submission', cleared===0, 'keys='+cleared);
await page.goBack();
await page.waitForTimeout(400);
const backState=await page.evaluate(()=>({url:location.pathname, step:document.body.innerText.match(/Step (\d) of/)?.[1]??null}));
ck('back after submit does not resurrect a filled form', backState.step===null||backState.step==='1', JSON.stringify(backState));

/* ── CONTACT ──────────────────────────────────────────────────────────── */
const p2=await ctx.newPage();
await p2.goto(BASE+'/contact',{waitUntil:'load'});
await p2.fill('#c-name','Flow Contact'); await p2.fill('#c-email','c@example.com');
await p2.selectOption('#c-reason','general');
await p2.fill('#c-message','Checking the contact route end to end.');
await Promise.all([p2.waitForURL(/thank-you\/message/,{timeout:20000}), p2.getByRole('button',{name:/send|submit/i}).click()]);
await settle();
ck('contact form lands on /thank-you/message', p2.url().includes('/thank-you/message'));
const c=allRecords().find(r=>r.kind==='contact');
ck('contact reached the store transport', !!c);
ck('contact record carries NO consent block', c && c.consent===undefined);

/* ── PRODUCER APPLICATION ─────────────────────────────────────────────── */
const p3=await ctx.newPage();
await p3.goto(BASE+'/careers/apply',{waitUntil:'load'});
await p3.fill('#a-name','Flow Agent'); await p3.fill('#a-email','a@example.com'); await p3.fill('#a-phone','9522327177');
await p3.fill('#a-states','Minnesota');
await p3.getByText('Life licensed',{exact:true}).click();
await p3.selectOption('#a-experience','1-3');
await p3.fill('#a-motivation','Interested in an independent contract and carrier access.');
await p3.getByText('Just exploring',{exact:true}).click();
await p3.check('#a-consent');
await Promise.all([p3.waitForURL(/thank-you\/apply/,{timeout:20000}), p3.getByRole('button',{name:/send|submit|apply/i}).click()]);
await settle();
ck('producer form lands on /thank-you/apply', p3.url().includes('/thank-you/apply'));
const a=allRecords().find(r=>r.kind==='agent');
ck('producer reached the store transport', !!a);
ck('producer record carries AGENT consent', a?.consent?.version==='agent-tcpa-v1');
ck('producer consent text mentions producer opportunities', a?.consent?.text?.includes('producer opportunities')===true);

/* ── DOUBLE SUBMIT ────────────────────────────────────────────────────── */
const p4=await ctx.newPage();
await p4.goto(BASE+'/contact',{waitUntil:'load'});
await p4.fill('#c-name','Double Submit'); await p4.fill('#c-email','d@example.com');
await p4.selectOption('#c-reason','general'); await p4.fill('#c-message','Double submit probe for the audit.');
const btn=p4.getByRole('button',{name:/send|submit/i});
const before=allRecords().length;
await btn.click(); await btn.click({force:true}).catch(()=>{}); await btn.click({force:true}).catch(()=>{});
await p4.waitForURL(/thank-you\/message/,{timeout:20000});
await p4.waitForTimeout(800);
await settle();
const dupes=allRecords().length-before;
ck('rapid triple-click sends exactly one record', dupes===1, 'sent='+dupes);

ck('no console/page errors during any form flow', errors.length===0, errors.slice(0,2).join(' | '));
console.log(`\n  ${pass} passed, ${fail} failed`);
await browser.close();

process.exit(fail ? 1 : 0);
