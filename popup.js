const $=id=>document.getElementById(id);
const HISTORY_KEY='kartTimeReaderData';
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function sec(v){return Number.isFinite(Number(v))?Number(v):Infinity}
function fmt(v){return Number.isFinite(Number(v))?Number(v).toFixed(3)+' s':'—'}
async function getData(){return (await chrome.storage.local.get(HISTORY_KEY))[HISTORY_KEY]||{heats:[],karts:{},current:null,meta:{}}}
function renderLive(data){
  $('session').textContent='Sessie: '+(data?.session||'—'); $('updated').textContent=data?.updated?new Date(data.updated).toLocaleTimeString():'—';
  const rows=data?.karts||[];
  if(!rows.length){$('table').innerHTML='<div class="empty">Nog geen karts gevonden.<br>Open Apex live timing en wacht op de ranking.</div>';return}
  $('table').innerHTML='<div class="row head"><span>Kart</span><span>Naam</span><span>Beste tijd</span><span>Bron</span></div>'+rows.map(r=>`<div class="row"><span class="kart">${esc(r.kart)}</span><span>${esc(r.driver||'—')}</span><span class="time best">${esc(r.best||'—')}</span><span class="source">${esc(r.source||'best')}</span></div>`).join('');
}
function rankingScore(k){
  // 70% average, 30% best: consistent karts rank above a one-off fast lap.
  return sec(k.averageSec)*0.70+sec(k.bestSec)*0.30;
}
function renderRanking(data){
  const list=Object.values(data.karts||{}).filter(k=>Number.isFinite(k.averageSec)).sort((a,b)=>rankingScore(a)-rankingScore(b));
  if(!list.length){$('rankingTable').innerHTML='<div class="empty">Nog geen opgeslagen heats. Laat minstens één heat volledig uitrijden.</div>';return}
  $('rankingTable').innerHTML=list.map((k,i)=>`<div class="rank-row"><span class="pos">${i+1}</span><span><b>Kart ${esc(k.kart)}</b><small>${esc(k.driver||'')}</small></span><span class="avg">${fmt(k.averageSec)}</span><span>${fmt(k.bestSec)}</span><span>${k.heats?.length||0}</span></div>`).join('');
}
function renderHeats(data){
  const heats=[...(data.heats||[])].sort((a,b)=>(b.finishedAt||b.updatedAt||0)-(a.finishedAt||a.updatedAt||0));
  if(data.current)heats.unshift({...data.current,status:'live'});
  if(!heats.length){$('heatTable').innerHTML='<div class="empty">Nog geen heats opgeslagen.</div>';return}
  $('heatTable').innerHTML=heats.map((h,i)=>`<article class="heat"><div><b>${esc(h.name||'Onbekende heat')}</b><span>${esc(h.phase||'')} · ${h.status==='live'?'LIVE':'OPGESLAGEN'}</span></div><div class="heat-count">${h.karts?.length||0} karts</div></article>`).join('');
}
async function refreshAll(){const data=await getData();renderRanking(data);renderHeats(data)}
async function activeTab(){const t=await chrome.tabs.query({active:true,currentWindow:true});return t[0]}
async function read(){
 const tab=await activeTab();
 if(!tab?.url?.includes('apex-timing.com')){$('status').textContent='Open eerst Apex Timing';return}
 chrome.tabs.sendMessage(tab.id,{type:'READ_NOW'},res=>{if(chrome.runtime.lastError){$('status').textContent='Open de live-timing opnieuw';return} $('status').textContent=res?.ok?'Verbonden':'Geen data';if(res)renderLive(res);refreshAll()});
}
$('open').onclick=async()=>{const u=$('url').value.trim();if(!u)return;await chrome.tabs.create({url:u});$('status').textContent='Live timing geopend'};
$('refresh').onclick=read;
$('clear').onclick=async()=>{if(confirm('Alle heats en rankinggegevens wissen?')){await chrome.storage.local.remove(HISTORY_KEY);await refreshAll();$('status').textContent='Alles gewist'}};
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));btn.classList.add('active');$(btn.dataset.tab).classList.remove('hidden');if(btn.dataset.tab!=='live')refreshAll()});
chrome.runtime.onMessage.addListener(m=>{if(m.type==='APEX_UPDATE')renderLive(m.data);if(m.type==='RANKING_UPDATE')refreshAll()});
read();refreshAll();
