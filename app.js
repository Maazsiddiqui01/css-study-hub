
let DATA, state={q:'',subject:'all',sort:'new'};
const $=s=>document.querySelector(s);
const norm=s=>(s||'').toLowerCase();

async function load(){
  DATA=await (await fetch('data.json')).json();
  const subs=['all',...DATA.subjects.map(s=>s.name)];
  $('#subs').innerHTML=subs.map(n=>{
    const s=DATA.subjects.find(x=>x.name===n);
    const st=s?`--acc:${s.accent}`:'--acc:#8B8490';
    return `<button class="chip" data-s="${n}" style="${st}">${n==='all'?'All':(s.emoji+' '+n)}</button>`;
  }).join('');
  document.querySelectorAll('#subs .chip').forEach(c=>c.onclick=()=>{state.subject=c.dataset.s;paint();});
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
  const meta=[s.date,s.length,(s.topics+' topics')].filter(Boolean).map(x=>`<span class="pill">${x}</span>`).join('');
  return `<article class="card" style="--acc:${s.accent}">
    <div class="sub-tag"><span class="d"></span>${s.emoji||''} ${s.subject}</div>
    <h3><a href="${s.url}">${s.title}</a></h3>
    <div class="desc">${s.subtitle||''}</div>
    <div class="meta">${meta}</div>
    <div class="actions"><a class="btn web" href="${s.url}">Read notes →</a>
    ${s.pdf_url?`<a class="btn pdf" href="${s.pdf_url}" target="_blank" rel="noopener">PDF ↓</a>`:''}
    ${s.video_url?`<a class="btn vid" href="${s.video_url}" target="_blank" rel="noopener">▶ Video</a>`:''}</div>
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
  document.querySelectorAll('#subs .chip').forEach(c=>c.classList.toggle('on',c.dataset.s===state.subject));
  let list=DATA.sessions.filter(s=>state.subject==='all'||s.subject===state.subject);
  if(q) list=list.filter(s=>s.search.includes(q));
  // `sort` is 0 for course material with no real date, so fall back to the
  // explicit syllabus `order` to keep modules in teaching sequence.
  const by={new:(a,b)=>(b.sort-a.sort)||((a.order||0)-(b.order||0)),
    old:(a,b)=>(a.sort-b.sort)||((a.order||0)-(b.order||0)),
    az:(a,b)=>a.title.localeCompare(b.title),long:(a,b)=>(b.mins||0)-(a.mins||0)};
  list.sort(by[state.sort]);
  const R=$('#results');
  if(!list.length){R.innerHTML='<div class="empty">No notes match “'+state.q+'”.</div>';$('#count').textContent='0 notes';return;}
  // Browsing everything with no query lands on the grouped contents view;
  // picking a subject or searching drops to a flat list, already narrow.
  if(state.subject==='all' && !q){
    R.innerHTML=DATA.subjects.map(sub=>{
      const items=list.filter(s=>s.subject===sub.name);
      if(!items.length) return '';
      const prev=items.slice(0,3).map(s=>s.title.split(':')[0]).join(' · ');
      return `<details class="grp" style="--acc:${sub.accent}">
        <summary class="grp-head"><span class="ge">${sub.emoji||''}</span>
        <span class="gt"><span class="gn">${sub.name}</span><span class="gp">${prev}</span></span>
        <span class="gc">${items.length}</span><span class="gx">›</span></summary>
        <div class="grp-body">${groupBody(items,q)}</div></details>`;
    }).join('');
  } else {
    R.innerHTML=list.map(s=>card(s,q)).join('');
  }
  $('#count').textContent=list.length+(list.length===1?' note':' notes');
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
let deferred;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#install').hidden=false;});
$('#install').onclick=async()=>{ if(!deferred)return; deferred.prompt(); await deferred.userChoice; deferred=null; $('#install').hidden=true; };
load();
