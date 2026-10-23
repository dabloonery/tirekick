import { start, EXT, sleep } from "./lib.ts";
const { open, c } = await start();
const OUT = Deno.env.get("AUDIT_OUT")!;
const o = await open(`chrome-extension://${EXT}/options/options.html`);
const setStore = (js: string) => o.ev(`chrome.storage.local.set(${js})`);
const R = (p: any, js: string) => p.ev(`(()=>{const r=document.getElementById('tirekick-host')?.shadowRoot; if(!r) return 'NO HOST'; ${js}})()`);
const panelShot = (p: any, name: string) => p.shot(`${OUT}/${name}.png`, { x: 980, y: 20, width: 420, height: 870 });
const scheme = async (p: any, s: string) => c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: s }] }, p.sessionId);

// metrics injected into a page: targets, contrast, sizes
const METRICS = `(root)=>{
 const lum=(c)=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2])};
 const parse=(s)=>{const m=s.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const a=m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);return {r:a[0],g:a[1],b:a[2],a:a[3]??1}};
 const bgOf=(el)=>{let layers=[];for(let n=el;n;n=n.parentElement||n.getRootNode().host){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=1)break}if(!n.parentElement&&!n.getRootNode().host)break}let base={r:255,g:255,b:255};for(const l of layers.reverse()){base={r:base.r*(1-l.a)+l.r*l.a,g:base.g*(1-l.a)+l.g*l.a,b:base.b*(1-l.a)+l.b*l.a}}return [base.r,base.g,base.b]};
 const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 const out={small:[],contrast:[],sizes:{},weights:{}};
 const all=[...root.querySelectorAll('*')];
 for(const el of all){
  const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden')continue;
  const r=el.getBoundingClientRect(); if(!r.width||!r.height)continue;
  const label=(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,28);
  const interactive=el.matches('button,a[href],input,select,textarea,summary,[role=tab],[role=radio],[tabindex="0"]');
  if(interactive&&(r.width<24||r.height<24)&&cs.opacity!=='0'&&!el.classList.contains('tk-x')) out.small.push(el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ')[0]+' "'+label+'" '+Math.round(r.width)+'x'+Math.round(r.height));
  const txt=[...el.childNodes].some(n=>n.nodeType===3&&n.nodeValue.trim());
  if(txt){
   const fs=Math.round(parseFloat(cs.fontSize)*10)/10; out.sizes[fs]=(out.sizes[fs]||0)+1; out.weights[cs.fontWeight]=(out.weights[cs.fontWeight]||0)+1;
   const fg=parse(cs.color); if(!fg)continue; const bg=bgOf(el);
   const fgc=[fg.r*fg.a+bg[0]*(1-fg.a),fg.g*fg.a+bg[1]*(1-fg.a),fg.b*fg.a+bg[2]*(1-fg.a)];
   const cr=ratio(fgc,bg); const large=fs>=24||(fs>=18.66&&+cs.fontWeight>=700);
   if(cr<(large?3:4.5)&&+cs.opacity>=0.99) out.contrast.push(cr.toFixed(2)+' '+fs+'px "'+(el.textContent||'').trim().slice(0,26)+'" '+el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ')[0]);
  }
 }
 return out;}`;
const report: any = {};

for (const mode of ["dark", "light"]) {
  // ---- no key: first run ----
  await setStore(`{anthropicKey:'', anthropicUrl:'http://localhost:1234', useSoldComps:false}`);
  await o.ev(`chrome.storage.local.remove(['introDone','scans','listingMemory','saved','savedSearches','notInterested','usage'])`);
  let p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await scheme(p, mode); await sleep(1500);
  await panelShot(p, `${mode}_01_first_run`);
  await p.ev(`1`);
  // closed state, page region around the tab
  await R(p, `r.querySelector('[data-act=intro-done]').click(); r.querySelector('[data-act=tab]').click()`); await sleep(500);
  await p.shot(`${OUT}/${mode}_02_page_closed.png`, { x: 0, y: 0, width: 1400, height: 900 });
  // ---- with key ----
  await setStore(`{anthropicKey:'sk-ant-test', introDone:true}`); await sleep(500);
  p = await open(`https://www.ebay.com/sch/i.html?_nkw=pentax+k1000`); await scheme(p, mode); await sleep(1500);
  await R(p, `r.querySelector('[data-act=tab]').click()`); await sleep(500);
  await panelShot(p, `${mode}_03_pre_scan`);
  report[mode + "_pre_scan"] = await R(p, `return (${METRICS})(r)`);
  await R(p, `r.querySelector('[data-mode=reseller]').click()`); await sleep(300);
  await panelShot(p, `${mode}_03b_reseller`);
  await R(p, `r.querySelector('[data-mode=buyer]').click()`); await sleep(300);
  await R(p, `r.querySelector('[data-act=scan]').click()`); await sleep(2600);
  const rowAt = await R(p, `const b=r.querySelector('.list .row').getBoundingClientRect(); return [b.x+b.width/2, b.y+b.height/2]`);
  await p.ev(`1`); await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rowAt[0], y: rowAt[1] }, p.sessionId); await sleep(200);
  await panelShot(p, `${mode}_04_scanned`);
  report[mode + "_scanned"] = await R(p, `return (${METRICS})(r)`);
  await p.shot(`${OUT}/${mode}_05_cards.png`, { x: 0, y: 0, width: 980, height: 660 });
  report[mode + "_cards_page"] = await p.ev(`(${METRICS})(document)`).then((x: any) => ({ contrast: x.contrast.filter((s: string) => /tk-|second/.test(s)) }));
  await p.ev(`document.querySelector('.tirekick-sticker').focus()`); await sleep(300);
  await p.shot(`${OUT}/${mode}_06_hovercard.png`, { x: 0, y: 80, width: 500, height: 400 });
  await R(p, `r.querySelector('.qf-toggle').click(); r.querySelector('.spend').click()`); await sleep(400);
  await panelShot(p, `${mode}_07_filter_spend`);
  await R(p, `r.querySelector('.qf-toggle').click(); r.querySelector('.spend').click()`);
  // ideas
  await R(p, `r.querySelector('[data-act=ideas]').click()`); await sleep(1500);
  await R(p, `r.querySelector('.ideas-inline').scrollIntoView()`); await sleep(300);
  await panelShot(p, `${mode}_08_ideas`);
  // saved view: save two, hide one
  await p.ev(`(()=>{})()`);
  await R(p, `[...r.querySelectorAll('.list .row')].slice(0,2).forEach(row=>[...row.querySelectorAll('button')].find(b=>/Save/.test(b.textContent))?.click())`); await sleep(500);
  await R(p, `[...r.querySelectorAll('.list .row')][2] && [...[...r.querySelectorAll('.list .row')][2].querySelectorAll('button')].find(b=>b.textContent==='Hide')?.click()`); await sleep(500);
  await R(p, `r.querySelector('[data-view=saved]').click()`); await sleep(500);
  await panelShot(p, `${mode}_09_saved`);
  report[mode + "_saved"] = await R(p, `return (${METRICS})(r)`);
  await R(p, `r.querySelector('[data-view=home]').click()`); await sleep(800);
  await panelShot(p, `${mode}_09b_home`);
  report[mode + "_home"] = await R(p, `return (${METRICS})(r)`);
  await R(p, `r.querySelector('.body').scrollTop = 99999`); await sleep(200);
  await panelShot(p, `${mode}_09c_home_lower`);
  // item page
  const it = await open(`https://www.ebay.com/itm/184891897312`); await scheme(it, mode); await sleep(2200);
  await R(it, `r.querySelector('[data-act=tab]').click()`); await sleep(400);
  await R(it, `r.querySelector('[data-act=analyze]').click()`); await sleep(2600);
  await it.shot(`${OUT}/${mode}_10_item.png`, { x: 980, y: 20, width: 420, height: 870 });
  report[mode + "_item"] = await R(it, `return (${METRICS})(r)`);
  // error state: bad key
  await setStore(`{anthropicKey:'bad'}`);
  await o.ev(`chrome.storage.local.remove(['scoreCache','listingMemory','scans'])`); // otherwise remembered scores come back and nothing is sent
  const er = await open(`https://www.ebay.com/sch/i.html?_nkw=film+camera`); await scheme(er, mode); await sleep(1500);
  await R(er, `r.querySelector('[data-act=tab]').click()`); await sleep(400);
  await R(er, `r.querySelector('[data-act=scan]').click()`); await sleep(3500);
  await panelShot(er, `${mode}_11_error`);
  await setStore(`{anthropicKey:'sk-ant-test'}`);
}
// settings
for (const mode of ["dark", "light"]) {
  const s = await open(`chrome-extension://${EXT}/options/options.html`); await scheme(s, mode); await sleep(800);
  const h = await s.ev(`document.documentElement.scrollHeight`);
  await s.shot(`${OUT}/${mode}_12_settings_full.png`, { x: 300, y: 0, width: 800, height: Math.min(h, 3400) });
  report[mode + "_settings"] = await s.ev(`(${METRICS})(document.body)`);
  await c.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }, s.sessionId); await sleep(400);
  await s.shot(`${OUT}/${mode}_13_settings_narrow.png`, { x: 0, y: 0, width: 390, height: 844 });
}
await Deno.writeTextFile(`${OUT}/metrics.json`, JSON.stringify(report, null, 1));
c.close();
