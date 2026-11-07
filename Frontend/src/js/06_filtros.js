/* 06_filtros: listas desplegables de SELECCIÓN MÚLTIPLE (varios meses, varios TAD, etc.).
   Sin nada marcado = "Todos". Se usan en la barra de filtros y en el comparador por periodos. */
const MS={};
let msOpen=null;
const msLabel=(c,v)=>{const it=c.items().find(x=>String(x[0])===String(v));return it?it[1]:String(v);};

MS['f-tad']={all:'Todas',items:()=>TADS.map(t=>[t,t]),get:()=>S.tad,set:v=>{S.tad=v;},off:()=>S.mod==='comparador',change:()=>{S.page=1;refresh();}};
MS['f-anio']={all:'Todos',items:()=>ANIOS.map(a=>[a,a]),get:()=>S.anio,set:v=>{S.anio=v;},change:()=>{S.page=1;refresh();}};
MS['f-mes']={all:'Todos',items:()=>MESES.map((m,i)=>[i,m]),get:()=>S.mes,set:v=>{S.mes=v;},change:()=>{S.page=1;refresh();}};
MS['f-dia']={all:'Todos',items:()=>Array.from({length:31},(_,i)=>[i+1,i+1]),get:()=>S.dia,set:v=>{S.dia=v;},change:()=>{S.page=1;refresh();}};
MS['f-hora']={all:'Todas',items:()=>Array.from({length:24},(_,i)=>[i,String(i).padStart(2,'0')+':00']),get:()=>S.hora,set:v=>{S.hora=v;},change:()=>{S.page=1;refresh();}};
MS['f-est']={all:'Todos',items:()=>[...OPC_ESTATUS,'Sin estatus'].map(s=>[s,s]),get:()=>S.est,set:v=>{S.est=v;},change:()=>{S.page=1;refresh();}};
MS['f-tipo']={all:'Todos',items:()=>tiposDelMod().map(t=>[t,t]),get:()=>S.tipo,set:v=>{S.tipo=v;},change:()=>{S.page=1;refresh();}};
/* El comparador por periodos NO va aqui: es un <select> normal de un solo mes, sin casillas. */
/* Alcance del comparador: vacio = todas las terminales; con casillas marcadas solo cuentan esas. */
MS['cmpScope']={all:'Todas las TAD',items:()=>TADS.map(t=>[t,t]),get:()=>S.cmpScope,set:v=>{S.cmpScope=v;},change:()=>renderMain()};

function msRender(id){
  const c=MS[id], host=document.getElementById(id); if(!host) return;
  const items=c.items(), sel=c.get()||[], off=c.off&&c.off();
  const lista=sel.map(v=>msLabel(c,v));
  const txt=off||!sel.length?c.all:(lista.length<=2?lista.join(', '):lista.length+' seleccionados');
  const abierto=msOpen===id&&!off;
  host.innerHTML=`<button type="button" class="ms-btn" data-ms="btn" data-id="${id}" aria-haspopup="listbox" aria-expanded="${abierto}" ${off?'disabled':''}><span class="ms-lab ${sel.length&&!off?'on':''}">${esc(txt)}</span>${ico('chev',14)}</button>`
   +(abierto?`<div class="ms-pop" role="listbox" aria-multiselectable="true"><label class="ms-it ms-todos"><input type="checkbox" data-ms="todos" data-id="${id}" ${sel.length?'':'checked'}><span>${esc(c.all)}</span></label><div class="ms-list">${items.map(([v,t])=>`<label class="ms-it"><input type="checkbox" data-ms="chk" data-id="${id}" value="${esc(v)}" ${sel.some(x=>String(x)===String(v))?'checked':''}><span>${esc(t)}</span></label>`).join('')}</div></div>`:'');
}
function msRenderAll(){Object.keys(MS).forEach(msRender);}
function msCerrar(){if(msOpen){const id=msOpen;msOpen=null;msRender(id);}}

document.addEventListener('click',e=>{
  const a=e.target.closest('[data-ms]');
  if(!a){ if(msOpen&&!e.target.closest('.ms')) msCerrar(); return; }
  const id=a.dataset.id, c=MS[id]; if(!c) return;
  const kind=a.dataset.ms;
  if(kind==='btn'){const previo=msOpen; msOpen=previo===id?null:id; if(previo&&previo!==id) msRender(previo); return msRender(id);}
  const host=document.getElementById(id), lista=host.querySelector('.ms-list'), top=lista?lista.scrollTop:0;
  if(kind==='todos'){c.set([]);}
  if(kind==='chk'){
    const items=c.items(), it=items.find(x=>String(x[0])===a.value); if(!it) return;
    let sel=(c.get()||[]).slice();
    const i=sel.findIndex(x=>String(x)===a.value);
    if(i>=0) sel.splice(i,1); else sel.push(it[0]);
    if(sel.length===items.length) sel=[];            // todo marcado = sin filtro
    c.set(sel);
  }
  c.change();
  msRender(id);
  const h2=document.getElementById(id), l2=h2&&h2.querySelector('.ms-list'); if(l2) l2.scrollTop=top;
  const foco=h2&&h2.querySelector(kind==='chk'?`input[value="${CSS.escape(a.value||'')}"]`:'input[data-ms="todos"]'); if(foco) foco.focus({preventScroll:true});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape') msCerrar();});
