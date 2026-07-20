
let DATA, state={q:'',subject:'all',sort:'new',status:'all'};
const $=s=>document.querySelector(s);
const norm=s=>(s||'').toLowerCase();

// Read-state lives in localStorage: per-device, no backend, survives redeploys
// because it is keyed by slug rather than by position.
const KEY='studyhub.read.v1';
let READ=new Set();
try{ READ=new Set(JSON.parse(localStorage.getItem(KEY)||'[]')); }catch(e){}
const isRead=s=>READ.has(s.slug);
function toggleRead(slug){
  READ.has(slug)?READ.delete(slug):READ.add(slug);
  try{ localStorage.setItem(KEY,JSON.stringify([...READ])); }catch(e){}
  paint();
}

// Time saved: watching the source at 2x costs mins/2; reading the note costs
// about 15 minutes. Anything below zero is not a saving, so floor it.
const READ_MINS=15;
const savedMins=s=>Math.max(0,(s.mins||0)/2-READ_MINS);
const hrs=m=>m>=60?(m/60).toFixed(m<600?1:0)+'h':Math.round(m)+'m';

function kpis(){
  const all=DATA.sessions, done=all.filter(isRead);
  const totalSave=all.reduce((a,s)=>a+savedMins(s),0);
  const doneSave=done.reduce((a,s)=>a+savedMins(s),0);
  const pct=all.length?Math.round(done.length/all.length*100):0;
  $('#kpis').innerHTML=`
    <div class="kpi"><b>${all.length}</b><span>Notes</span></div>
    <div class="kpi"><b>${all.length-done.length}</b><span>To read</span></div>
    <div class="kpi"><b>${done.length}</b><span>Done</span></div>
    <div class="kpi hero"><b>${hrs(doneSave)}</b><span>Time saved</span></div>`;
  $('#barfill').style.width=pct+'%';
  $('#barlab').innerHTML=done.length
    ? `<b>${pct}% read.</b> ${hrs(doneSave)} saved so far, ${hrs(totalSave)} on offer once you finish everything.`
    : `Mark a note done as you read it. Finishing all ${all.length} saves about <b>${hrs(totalSave)}</b> against watching the lectures at 2x speed.`;
}

async function load(){
  DATA=await (await fetch('data.json')).json();
  const subs=['all',...DATA.subjects.map(s=>s.name)];
  $('#subs').innerHTML=subs.map(n=>{
    const s=DATA.subjects.find(x=>x.name===n);
    const st=s?`--acc:${s.accent}`:'--acc:#8B8490';
    return `<button class="chip" data-s="${n}" style="${st}">${n==='all'?'All':(s.emoji+' '+n)}</button>`;
  }).join('');
  $('#statuses').innerHTML=[['all','All notes'],['todo','◦ To read'],['done','✓ Done']]
    .map(([k,l])=>`<button class="chip st" data-k="${k}" style="--acc:#46955C">${l}</button>`).join('');
  document.querySelectorAll('#subs .chip').forEach(c=>c.onclick=()=>{state.subject=c.dataset.s;paint();});
  document.querySelectorAll('#statuses .chip').forEach(c=>c.onclick=()=>{state.status=c.dataset.k;paint();});
  $('#q').oninput=e=>{state.q=e.target.value;paint();};
  $('#sort').onchange=e=>{state.sort=e.target.value;paint();};
  paint();
}

function matchSections(sess,q){
  if(!q) return [];
  return (sess.sections||[]).filter(x=>norm(x.title).includes(q));
}
function hi(t,q){ if(!q)return t; const i=norm(t).indexOf(q); if(i<0)return t;
  return t.slice(0,i)+'<mark>'+t.slice(i,i+q.length)+'</mark>'+t.slice(i+q.length); }

function card(s,q){
  const ms=matchSections(s,q);
  const secs=ms.length?`<div class="secs">${ms.map(x=>`<a href="${s.url}#${x.id}">↳ ${hi(x.title,q)}</a>`).join('')}</div>`:'';
  const save=savedMins(s);
  const meta=[s.date,s.length,(s.topics+' topics'),save?('saves ~'+hrs(save)):'']
    .filter(Boolean).map(x=>`<span class="pill">${x}</span>`).join('');
  const done=isRead(s);
  return `<article class="card${done?' isdone':''}" style="--acc:${s.accent}">
    <div class="sub-tag"><span class="d"></span>${s.emoji||''} ${s.subject}</div>
    <h3><a href="${s.url}">${s.title}</a></h3>
    <div class="desc">${s.subtitle||''}</div>
    <div class="meta">${meta}</div>
    <div class="actions"><a class="btn web" href="${s.url}">Read notes →</a>
    ${s.pdf_url?`<a class="btn pdf" href="${s.pdf_url}" target="_blank" rel="noopener">PDF ↓</a>`:''}
    ${s.video_url?`<a class="btn vid" href="${s.video_url}" target="_blank" rel="noopener">▶ Video</a>`:''}
    <button class="done${done?' on':''}" data-slug="${s.slug}">
      <span class="tick">${done?'✓':'○'}</span>${done?'Done':'Mark done'}</button></div>
    ${secs}</article>`;
}

// Inside a subject, notes may carry a `group` label (e.g. "Module 6 · Pollution").
// Render those as sub-headings in first-appearance order so a course reads in
// syllabus order rather than as one long undifferentiated list.
function groupBody(items,q){
  if(!items.some(x=>x.group)) return items.map(s=>card(s,q)).join('');
  const seen=[];
  items.forEach(s=>{const g=s.group||'Other';if(seen.indexOf(g)<0)seen.push(g);});
  return seen.map(g=>`<div class="modhead">${g}</div>`+
    items.filter(s=>(s.group||'Other')===g).map(s=>card(s,q)).join('')).join('');
}

function paint(){
  const q=norm(state.q).trim();
  kpis();
  document.querySelectorAll('#subs .chip').forEach(c=>c.classList.toggle('on',c.dataset.s===state.subject));
  document.querySelectorAll('#statuses .chip').forEach(c=>c.classList.toggle('on',c.dataset.k===state.status));
  let list=DATA.sessions.filter(s=>state.subject==='all'||s.subject===state.subject);
  if(state.status==='todo') list=list.filter(s=>!isRead(s));
  if(state.status==='done') list=list.filter(isRead);
  if(q) list=list.filter(s=>s.search.includes(q));
  // `sort` is 0 for course material with no real date, so fall back to the
  // explicit syllabus `order` to keep modules in teaching sequence.
  const by={new:(a,b)=>(b.sort-a.sort)||((a.order||0)-(b.order||0)),
    old:(a,b)=>(a.sort-b.sort)||((a.order||0)-(b.order||0)),
    az:(a,b)=>a.title.localeCompare(b.title),long:(a,b)=>(b.mins||0)-(a.mins||0)};
  list.sort(by[state.sort]);
  const R=$('#results');
  const empty={all:'No notes match “'+state.q+'”.',
    todo:'Nothing left to read here. Every note is marked done.',
    done:'No notes marked done yet. Tap “Mark done” on one as you finish it.'}[state.status];
  if(!list.length){R.innerHTML='<div class="empty">'+empty+'</div>';$('#count').textContent='0 notes';bind();return;}
  // Browsing everything with no query lands on the grouped contents view;
  // picking a subject or searching drops to a flat list, already narrow.
  if(state.subject==='all' && !q){
    R.innerHTML=DATA.subjects.map(sub=>{
      const items=list.filter(s=>s.subject===sub.name);
      if(!items.length) return '';
      const nd=items.filter(isRead).length;
      const prev=items.slice(0,3).map(s=>s.title.split(':')[0]).join(' · ');
      return `<details class="grp" style="--acc:${sub.accent}">
        <summary class="grp-head"><span class="ge">${sub.emoji||''}</span>
        <span class="gt"><span class="gn">${sub.name}</span><span class="gp">${prev}</span></span>
        ${nd?`<span class="gd">✓ ${nd}</span>`:''}
        <span class="gc">${items.length}</span><span class="gx">›</span></summary>
        <div class="grp-body">${groupBody(items,q)}</div></details>`;
    }).join('');
  } else {
    R.innerHTML=list.map(s=>card(s,q)).join('');
  }
  $('#count').textContent=list.length+(list.length===1?' note':' notes');
  bind();
}

// Re-attach after every repaint, since innerHTML replaces the nodes.
function bind(){
  document.querySelectorAll('.done').forEach(b=>b.onclick=e=>{
    e.preventDefault();
    const d=b.closest('details'); const open=d?d.open:false;
    toggleRead(b.dataset.slug);
    if(d){const nd=document.querySelector(`details.grp .done[data-slug="${b.dataset.slug}"]`);
      const nx=nd&&nd.closest('details'); if(nx) nx.open=open;}
  });
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
let deferred;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#install').hidden=false;});
$('#install').onclick=async()=>{ if(!deferred)return; deferred.prompt(); await deferred.userChoice; deferred=null; $('#install').hidden=true; };
load();
