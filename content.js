(() => {
  const TIME_RE=/^(?:\d{1,2}:)?\d{1,2}[\.,]\d{2,3}$/;
  const HISTORY_KEY='kartTimeReaderData';
  const state={session:'',updated:0,karts:[],phase:'',sessionKey:''};
  let lastSessionKey='';
  let emptyReads=0;

  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const normalizeTime=s=>clean(s).replace(',','.');
  function timeToSec(s){
    s=normalizeTime(s); if(!TIME_RE.test(s)) return null;
    const p=s.split(':').map(Number);
    return p.length===3?p[0]*3600+p[1]*60+p[2]:p.length===2?p[0]*60+p[1]:p[0];
  }
  function looksTime(s){const n=timeToSec(s);return n!==null&&n>10&&n<300}
  function formatTime(sec){return Number(sec).toFixed(3)+' s'}

  function extractBest(row){
    const cells=[...row.querySelectorAll('td,th')];
    const preferred=cells.filter(c=>/posbest|best|personal|fast|bestlap/i.test(c.className+' '+c.id+' '+[...c.attributes].map(a=>a.value).join(' ')));
    for(const c of preferred){const t=clean(c.innerText);if(looksTime(t))return {value:normalizeTime(t),source:'best-cell'}}
    const times=[];
    for(const c of cells){const t=clean(c.innerText);if(looksTime(t))times.push(t)}
    if(!times.length)return null;
    times.sort((a,b)=>timeToSec(a)-timeToSec(b));
    return {value:normalizeTime(times[0]),source:'fastest-visible'};
  }
  function extractKart(row){
    const cells=[...row.querySelectorAll('td,th')];
    for(const c of cells){
      const type=(c.getAttribute('data-type')||'').toLowerCase(); const t=clean(c.innerText);
      if(/kart|number|num|rk|car/.test(type)&&/^\d{1,3}$/.test(t))return t;
    }
    for(const c of cells.slice(0,5)){const t=clean(c.innerText);if(/^\d{1,3}$/.test(t)&&Number(t)>0&&Number(t)<1000)return t}
    return null;
  }
  function extractDriver(row){
    const cells=[...row.querySelectorAll('td,th')];
    for(const c of cells){const type=(c.getAttribute('data-type')||'').toLowerCase();if(/dr|driver|name|pilot/.test(type)){const t=clean(c.innerText);if(t&&!looksTime(t)&&!/^[0-9]+$/.test(t))return t}}
    for(const c of cells){const t=clean(c.innerText);if(t&&!looksTime(t)&&t.length>2&&!/^\d+$/.test(t)&&!/^[-+]?\d/.test(t))return t}
    return '';
  }
  function findRows(){
    const selectors=['#tgrid tbody tr','#tgrid tr','table tbody tr'];
    let rows=[];for(const s of selectors){rows=[...document.querySelectorAll(s)];if(rows.length)break}return rows;
  }
  function getText(selectors){for(const s of selectors){const e=document.querySelector(s);if(e&&clean(e.innerText))return clean(e.innerText)}return ''}
  function sessionName(){
    const candidates=['#title_bar','.title_bar','h1','h2','.session_name','.session','.race_name','.event-name'];
    const found=getText(candidates);
    return found||clean(document.title)||location.pathname;
  }
  function phaseName(){
    const text=[...document.querySelectorAll('body *')].slice(0,300).map(e=>clean(e.innerText)).filter(t=>t&&t.length<120).join(' | ');
    const m=text.match(/(Final|Finale|Semi Final|Semi-Final|Heat\s*\d+[A-Z]?|Kwalificatie|Qualification|Race\s*\d+)/i);
    return m?clean(m[1]):'';
  }
  function makeSessionKey(name,phase){return (name+'|'+phase+'|'+location.pathname).toLowerCase().replace(/\s+/g,' ').trim()}

  async function getData(){return (await chrome.storage.local.get(HISTORY_KEY))[HISTORY_KEY]||{heats:[],karts:{},current:null,meta:{}}}
  async function setData(data){await chrome.storage.local.set({[HISTORY_KEY]:data})}

  function mergeKart(data,kart,driver,time,heat){
    const sec=timeToSec(time); if(sec===null)return;
    if(!data.karts[kart])data.karts[kart]={kart,driver:driver||'',heats:[],bestSec:null,bestTime:'',averageSec:null,averageTime:'',lastSec:null,lastTime:'',lastHeat:''};
    const k=data.karts[kart]; if(driver)k.driver=driver;
    let h=k.heats.find(x=>x.heatId===heat.id);
    if(!h){h={heatId:heat.id,name:heat.name,phase:heat.phase,timeSec:sec,time:formatTime(sec),savedAt:Date.now()};k.heats.push(h)}
    else if(sec<h.timeSec){h.timeSec=sec;h.time=formatTime(sec);h.savedAt=Date.now()}
    const vals=k.heats.map(x=>x.timeSec).filter(Number.isFinite);
    k.bestSec=Math.min(...vals); k.bestTime=formatTime(k.bestSec);
    k.averageSec=vals.reduce((a,b)=>a+b,0)/vals.length; k.averageTime=formatTime(k.averageSec);
    k.lastSec=sec;k.lastTime=formatTime(sec);k.lastHeat=heat.name;
  }

  async function finalizeCurrent(data){
    if(!data.current||!data.current.karts?.length)return;
    const existing=data.heats.find(h=>h.id===data.current.id);
    if(existing){Object.assign(existing,data.current);existing.status='finished';existing.finishedAt=Date.now()}
    else data.heats.push({...data.current,status:'finished',finishedAt:Date.now()});
    data.current=null;
  }

  async function read(){
    const rows=findRows();
    const map=new Map();
    for(const row of rows){
      const kart=extractKart(row), best=extractBest(row); if(!kart||!best)continue;
      const driver=extractDriver(row), old=map.get(kart);
      if(!old||timeToSec(best.value)<timeToSec(old.best))map.set(kart,{kart,driver,best:best.value,source:best.source});
    }
    if(!map.size){emptyReads++; return {ok:false,...state};}
    emptyReads=0;
    const name=sessionName(), phase=phaseName(), key=makeSessionKey(name,phase);
    const now=Date.now();
    state.session=name;state.phase=phase;state.sessionKey=key;state.updated=now;state.karts=[...map.values()].sort((a,b)=>Number(a.kart)-Number(b.kart));
    const data=await getData();

    // A changed session/heat means the previous live list is finished. Save it once.
    if(lastSessionKey && key!==lastSessionKey && data.current){await finalizeCurrent(data)}
    lastSessionKey=key;

    const heatId=key;
    const heat={id:heatId,name:name,phase:phase,karts:state.karts.map(r=>({kart:r.kart,driver:r.driver,best:r.best,bestSec:timeToSec(r.best)})),startedAt:data.current?.id===heatId?data.current.startedAt:now,updatedAt:now,status:'live'};
    data.current=heat;

    for(const r of state.karts)mergeKart(data,r.kart,r.driver,r.best,{id:heatId,name:name,phase:phase});
    data.meta.updatedAt=now;data.meta.lastSession=name;data.meta.lastPhase=phase;data.meta.url=location.href;
    await setData(data);
    chrome.runtime.sendMessage({type:'APEX_UPDATE',data:state}).catch(()=>{});
    chrome.runtime.sendMessage({type:'RANKING_UPDATE'}).catch(()=>{});
    return {ok:true,...state};
  }

  chrome.runtime.onMessage.addListener((m,_s,send)=>{
    if(m.type==='READ_NOW')read().then(send); return true;
  });
  setInterval(()=>read(),1000);
  const observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(()=>read(),250)});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  setTimeout(read,1000);
})();
