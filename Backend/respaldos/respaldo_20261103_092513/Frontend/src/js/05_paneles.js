/* 05_paneles: boletin del conductor y vista previa del correo */
let lastFocus=null;
/* Al tocar un tipo en "Eventos por tipo" el boletin se queda viendo solo ese evento:
   los KPIs, la grafica de meses y la lista de abajo se recalculan con lo elegido. */
const BOL={nombre:'',tipo:''};
const modDeTipo=t=>Object.values(MODS).find(m=>m.types&&m.types.includes(t));
const uniEv=M=>M.unit==='min'?'Duración':'Velocidad';
function openBulletin(name){
  if(!COND.find(x=>x.nombre===name)) return;
  BOL.nombre=name; BOL.tipo='';
  const dr=$('#drawer');
  lastFocus=document.activeElement;
  dr.classList.add('on');dr.setAttribute('aria-hidden','false');$('#overlay').classList.add('on');
  pintaBoletin();
  dr.querySelector('button').focus();
}
function pintaBoletin(){
  const c=COND.find(x=>x.nombre===BOL.nombre); if(!c) return;
  const dr=$('#drawer');
  const todos=EV.filter(e=>e.conductor===BOL.nombre);
  const M=BOL.tipo?modDeTipo(BOL.tipo):null;
  const l=M?todos.filter(e=>e.tipo_evento===BOL.tipo):todos;
  const ral=cuentan(todos.filter(e=>MODS.ralenti.types.includes(e.tipo_evento)));
  const maxV=Math.max(0,...cuentan(todos).map(e=>e.velocidad_max||0));
  const maxR=ral.length?Math.max(...ral.map(e=>e.duracion_min)):0;
  const avgR=ral.length?sum(ral.map(e=>e.duracion_min))/ral.length:0;
  const val=M?M.unit==='min'?(e=>e.duracion_min!=null?fhora(e.duracion_min):'—'):(e=>e.velocidad_max?e.velocidad_max+' km/h':'—'):medicion;
  /* Mismo criterio que en General y en los modulos: las graficas y los promedios dejan fuera lo descartado,
     y el total de la ficha sigue siendo todo lo que hay del conductor (por eso van Reales y Descartadas juntas). */
  const ok=cuentan(l);
  /* Un tipo con todo descartado sigue en la lista: su barra va en cero y debajo se ve cuantos son. */
  const byT=ALL_TIPOS.map(t=>{const a=todos.filter(e=>e.tipo_evento===t);return [t,a.filter(e=>e.estatus!=='Descartada').length,a.filter(e=>e.estatus==='Descartada').length];}).filter(x=>x[1]||x[2]);
  const mx=Math.max(1,...byT.map(x=>x[1]));
  const porMes=MES3.map((_,i)=>ok.filter(e=>e.mes===i).length);
  /* Una pila por mes con el aporte de cada tipo. El color sigue el orden de la lista de arriba, asi
     no cambia cuando se filtra por un solo evento. */
  const pilaMes=byT.map((x,i)=>[x[0],i]).filter(([t])=>ok.some(e=>e.tipo_evento===t))
    .map(([t,i])=>({n:t,c:PALETAS.institucional.c[i%PALETAS.institucional.c.length],
      v:MES3.map((_,mi)=>ok.filter(e=>e.tipo_evento===t&&e.mes===mi).length)}));
  const desc=l.length-ok.length;
  /* "Reales" no es una marca nueva en la base: es lo que queda de ese conductor (o de ese evento) sin descartar. */
  const celdaDesc=`<div class="stat"><span>Descartadas</span><b class="${desc?'w':''}">${desc}</b></div>
    <div class="stat"><span>Reales</span><b>${ok.length}</b></div>`;
  const lista=M?[...l].sort((a,b)=>(b[M.metric]||0)-(a[M.metric]||0)).slice(0,5)
    :[...todos].sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora)).slice(0,5);
  const stats=M?(()=>{
    const v=ok.map(e=>e[M.metric]).filter(x=>x!=null&&x>0);
    const u=x=>M.unit==='min'?fhora(x):fnum(Math.round(x*10)/10)+' '+M.unit;
    const ult=[...l].sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora))[0];
    return `<div class="stat"><span>${esc(M.title)}: eventos</span><b>${ok.length}</b></div>
      <div class="stat"><span>${uniEv(M)} máxima</span><b class="w">${v.length?u(Math.max(...v)):'—'}</b></div>
      <div class="stat"><span>${uniEv(M)} promedio</span><b>${v.length?u(sum(v)/v.length):'—'}</b></div>
      <div class="stat"><span>Último evento</span><b class="sm">${ult?esc(ult.dia+' '+MES3[ult.mes]+' · '+ult.hora):'—'}</b></div>${celdaDesc}`;
  })():`<div class="stat"><span>Total de eventos</span><b>${todos.length}</b></div>
      <div class="stat"><span>Velocidad máxima</span><b class="w">${maxV} km/h</b></div>
      <div class="stat"><span>Ralentí máximo</span><b class="w">${maxR?fhora(maxR):'—'}</b></div>
      <div class="stat"><span>Ralentí promedio</span><b>${avgR?fhora(avgR):'—'}</b></div>${celdaDesc}`;
  dr.innerHTML=`<header><div class="avatar">${esc(initials(c.nombre))}</div><div style="flex:1;min-width:0"><h3>${esc(c.nombre)}</h3><p>${esc(tadN(c.tad))} · Económico ${esc(c.num)}</p></div><button class="btn sm" data-act="closeAll" aria-label="Cerrar boletín">${ico('x',16)}</button></header>
  <div class="body">
    <div class="stats">${stats}</div>
    <h4>Eventos por tipo${M?` <button type="button" class="btn sm link" data-bol="tipo" data-v="${esc(BOL.tipo)}">${esc(BOL.tipo)} ✕</button>`:''}</h4>
    ${byT.map(([t,n,d])=>`<button type="button" class="bars-row" data-bol="tipo" data-v="${esc(t)}" aria-pressed="${BOL.tipo===t}" title="Ver el boletín solo con ${esc(t)}${d?' · '+d+' descartadas':''}"><span>${esc(t)}</span><span class="t"><i style="width:${n/mx*100}%"></i></span><b>${n}${d?`<small>${d} desc.</small>`:''}</b></button>`).join('')}
    <h4>Eventos por mes${M?' · '+esc(BOL.tipo):''}</h4>${miniBars(porMes,pilaMes)}
    <h4>${M?'Top 5 · '+esc(BOL.tipo):'Últimos 5 eventos'}</h4>
    <ul class="last">${lista.map(e=>`<li class="${e.estatus==='Descartada'?'desc':''}"><span>${esc(e.tipo_evento)}<small>${e.dia} ${MES3[e.mes]} ${e.fecha.slice(0,4)} · ${e.hora}${e.estatus==='Descartada'?' · descartada':''}</small></span><b class="val">${esc(val(e))}</b></li>`).join('')}</ul>
  </div>`;
}
function closeAll(){
  /* primero se devuelve el foco y luego se esconde el panel: al reves, el lector de pantalla
     se queda un instante con aria-hidden puesto sobre el boton que tiene el foco. Si el foco
     sigue dentro de un panel (el boton de origen ya no esta o era el propio cuerpo), se suelta. */
  if(lastFocus&&lastFocus!==document.body&&lastFocus.focus&&document.body.contains(lastFocus)) lastFocus.focus();
  lastFocus=null;
  [$('#drawer'),$('#modal'),$('#side')].forEach(p=>{if(p.contains(document.activeElement)) document.activeElement.blur();});
  $('#drawer').classList.remove('on');$('#drawer').setAttribute('aria-hidden','true');
  $('#modal').classList.remove('on');$('#overlay').classList.remove('on');
  $('#side').classList.remove('on');
}

/* ---- Periodo del reporte: se elige en su propia barra y NO toca los filtros del panel ---- */
const RS={vista:'mes',multi:true,anio:'',mes:[],dia:[]};
const rsSel=()=>RS.vista==='mes'?RS.mes:RS.dia;
const rsSet=v=>{if(RS.vista==='mes')RS.mes=v;else RS.dia=v;};
/* Los demas filtros (TAD, tipo, hora, estatus) si aplican; el periodo lo manda RS. */
const rsSinPeriodo=l=>applyF(l,['anio','mes','dia']);
/* Ano + filtros del panel, sin recortar mes ni dia. */
const rsAnio=l=>rsSinPeriodo(l).filter(e=>!RS.anio||e.anio===+RS.anio);
/* Ano + meses. En "Por mes" los meses son la eleccion; en "Por dia" son el alcance que decide
   de que meses salen los dias, para que al elegir enero no se mezcle con dias de los demas meses. */
const rsAlcance=l=>rsAnio(l).filter(e=>inSel(RS.mes,e.mes));
const rsFiltro=l=>RS.vista==='mes'?rsAlcance(l):rsAlcance(l).filter(e=>inSel(RS.dia,e.dia));
const rsNums=()=>rsSel().map(Number).sort((a,b)=>a-b);
/* En modo dia la lista no es 1..31 fijo: salen solo los dias que el alcance tiene, con su conteo. */
function rsOpts(){
  if(RS.vista==='mes') return MES3.map((m,i)=>[String(i),m]);
  const c=groupCount(rsAlcance(EV),'dia');
  return [...c.keys()].map(Number).sort((a,b)=>a-b).map(d=>[String(d),String(d),c.get(d)]);
}
/* Si el alcance se achica (cambiar mes, ano o filtros) se sueltan los dias que ya no existen:
   el dia 31 elegido con todos los meses debe irse al quedarse solo febrero, no dejar el reporte en 0. */
function rsPodar(){ if(RS.vista==='dia') RS.dia=RS.dia.filter(d=>rsOpts().some(o=>o[0]===String(d))); }
const rsMesLbl=a=>!a.length?'todos los meses':a.map(Number).sort((x,y)=>x-y).map(i=>MES3[i]).join(', ');
function rsEtiqueta(){
  const a=RS.anio?String(RS.anio):'todos los años';
  if(RS.vista==='mes'){const s=rsNums(), t=s.length?s.map(i=>MES3[i]):MES3.slice();
    return `${t[0]}${t.length>1?' – '+t[t.length-1]:''} · ${a}`;}
  const s=rsNums();
  return `${s.length?'Día'+(s.length>1?'s':'')+' '+s.join(', '):'Todos los días'} de ${rsMesLbl(RS.mes)} · ${a}`;
}
function rsPie(){
  const s=rsNums(), uno=s.length===1, a=RS.anio||'todos los años';
  if(RS.vista==='mes') return `${s.length?`${s.length} ${uno?'mes seleccionado':'meses seleccionados'} · ${s.map(i=>MES3[i]).join(', ')}`:'Todos los meses'} · ${a}`;
  return `${s.length?`${s.length} ${uno?'día seleccionado':'días seleccionados'} · ${s.join(', ')}`:'Todos los días'} · meses: ${rsMesLbl(RS.mes)} · ${a}`;
}
/* Barras de la seccion de periodo: una por mes elegido, o una por dia con eventos. */
function rsBarras(l){
  if(RS.vista==='mes'){const idx=rsNums().length?rsNums():MES3.map((_,i)=>i);
    return {tit:'Eventos por mes',filas:idx.map(i=>[MES3[i]||('Mes '+(+i+1)),l.filter(e=>e.mes===i).length])};}
  return {tit:'Eventos por día',filas:[...new Set(l.map(e=>e.dia))].sort((a,b)=>a-b).map(d=>[String(d),l.filter(e=>e.dia===d).length])};
}
/* Los chips de una fila: act="rschip" manda en la eleccion y "rsscope" cambia el alcance de meses. */
function rsChips(opts,act,arr,hay){
  return opts.map(([v,t,n])=>{const on=arr.some(x=>String(x)===v), vac=act==='rschip'&&!on&&hay&&!hay.has(v);
    return `<button type="button" class="rs-chip${on?' sel':''}${vac?' vac':''}" data-act="${act}" data-v="${v}" aria-pressed="${on}" ${n!=null?`title="${fmtN(n)} eventos en este día"`:''}>${esc(t)}${n!=null?`<i>${fmtN(n)}</i>`:''}${on?ico('check',12):''}</button>`;}).join('');
}
function rsBarra(){
  const enDias=RS.vista==='dia', hay=new Set(rsAnio(EV).map(e=>String(enDias?e.dia:e.mes)));
  return `<div class="rs-top">
    <div class="seg"><button type="button" data-act="rsvista" data-v="mes" aria-pressed="${RS.vista==='mes'}">${ico('cal',13)} Por mes</button><button type="button" data-act="rsvista" data-v="dia" aria-pressed="${enDias}">${ico('cal',13)} Por día</button></div>
    <div class="rs-tools">
      <button type="button" class="btn sm ${RS.multi?'green':''}" data-act="rsmulti" aria-pressed="${RS.multi}" title="Permitir marcar varios a la vez">${ico('layers',13)} Seleccionar varios${RS.multi?ico('check',12):''}</button>
      <button type="button" class="btn sm" data-act="rstodos" title="Quitar la selección y dejar todo el periodo">${ico('check',13)} Todos</button>
      <select data-rs="anio" aria-label="Año del reporte"><option value="">Todos</option>${ANIOS.map(y=>`<option value="${y}" ${String(RS.anio)===String(y)?'selected':''}>${y}</option>`).join('')}</select>
    </div>
  </div>
  <div class="rs-fila"><span class="rs-lbl">${enDias?'Meses de donde salen los días':'Meses'}</span><div class="rs-chips">${
    enDias?`<button type="button" class="rs-chip all${RS.mes.length?'':' sel'}" data-act="rsscope" data-v="" aria-pressed="${!RS.mes.length}">Todos</button>`:''
  }${rsChips(MES3.map((m,i)=>[String(i),m]),enDias?'rsscope':'rschip',RS.mes,hay)}</div></div>
  ${enDias?`<div class="rs-fila"><span class="rs-lbl">Días</span><div class="rs-chips">${rsChips(rsOpts(),'rschip',RS.dia,null)}</div></div>`:''}
  <div class="rs-pie"><span>${esc(rsPie())}</span><span class="rs-est">${ico('check',12)} Estatus: ${esc(S.est.join(', ')||'Todos')}</span></div>`;
}

/* ---- Reporte por correo: todos los modulos, en version con diseno (HTML con estilos en linea) y en texto ---- */
let REPORTE={html:'',texto:''};
const fmtN=n=>Number(n).toLocaleString('es-MX');
function variacionReporte(l){
  /* Compara el ultimo mes elegido contra el anterior; sin seleccion, el mes mas reciente de los datos. */
  const s=rsNums();
  const ref=RS.vista==='mes'&&s.length?s[s.length-1]:(l.length?Math.max(...l.map(e=>e.mes)):-1), pv=ref-1;
  if(pv<0) return {txt:'',color:'#5c6b81'};
  const a=l.filter(e=>e.mes===ref).length, b=l.filter(e=>e.mes===pv).length;
  if(!b) return {txt:'Sin datos en '+MES3[pv],color:'#5c6b81'};
  const p=Math.round((a-b)/b*100);
  if(p===0) return {txt:'= igual que '+MES3[pv],color:'#5c6b81'};
  return {txt:(p>0?'▲ ':'▼ ')+Math.abs(p)+'% vs '+MES3[pv],color:p>0?'#a4302a':'#2b4a7a'};
}
/* Los 5 conductores con mas eventos del modulo, sobre los datos ya filtrados por periodo y filtros. */
function top5Conductores(l,M){
  const g=groupCount(l.filter(e=>e.conductor&&e.conductor!=='Sin conductor'),'conductor');
  const t=[...g.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'es')).slice(0,5);
  return t.map(([con,n])=>{
    const ev=l.filter(e=>e.conductor===con);
    const tad=[...groupCount(ev,'tad').entries()].sort((a,b)=>b[1]-a[1])[0];
    const vals=ev.map(e=>e[M.metric]).filter(v=>v!=null);
    return {con,n,tad:tad?tad[0]:'—',
      max:vals.length?Math.max(...vals):null,unidades:new Set(ev.map(e=>e.num_economico)).size};
  });
}
/* El CSS del panel tiene reglas GLOBALES para table / th / td (05_tablas.css): white-space:nowrap,
   padding:15px, text-align:left y un fondo gris en la ultima fila de cada tbody. Los atributos
   bgcolor / align / valign / width del HTML cuentan como lo mas bajo del cascade, así que esas reglas
   los PISAN: por eso la vista previa salia recortada, con las barras infladas y con frases casi
   invisibles (el navy del encabezado se volvia gris y el texto claro desaparecia), mientras que en el
   correo —que no carga ese CSS— se ve bien. Este paso copia cada atributo al style en linea del
   elemento, que es lo unico que el CSS del panel no puede tocar. Los atributos se conservan igual:
   Outlook y Word los entienden mejor que el CSS, así que el correo sale identico o mas fiel. */
const AISLA_P={bgcolor:'background-color',align:'text-align',valign:'vertical-align',width:'width',height:'height'};
function aisla(h){
  return h.replace(/<([a-z]+)([^>]*?)>/gi,(m,tag,at)=>{
    const t=tag.toLowerCase(), adds=[];
    for(const a in AISLA_P){
      const x=new RegExp('\\s'+a+'="([^"]+)"','i').exec(at); if(!x) continue;
      let v=x[1].trim();
      if((a==='width'||a==='height') && /^\d+$/.test(v)) v+='px';
      if(a==='align'&&t==='table') adds.push(v==='center'?'margin:0 auto':v==='right'?'margin-left:auto':'margin-right:auto');
      else adds.push(AISLA_P[a]+':'+v);
    }
    if(!adds.length) return m;
    const s=/ style="([^"]*)"/i.exec(at);
    return s? m.replace(' style="'+s[1]+'"',' style="'+s[1]+';'+adds.join(';')+'"')
            : m.replace(/>$/,' style="'+adds.join(';')+'">');
  });
}
function construirReporte(){
  /* Misma regla que en el panel: descartar = dejar de contar (cuentan()). El reporte sale SIN las
     "Descartada", pero el mosaico sigue mostrando cuántas hay para que el numero cuadre con lo que
     la persona ve en pantalla. Si en el filtro de Estatus se pide "Descartada", cuentan() manda el
     filtro y el reporte sale SOLO con esas, que es lo que se pidio. */
  const todos=rsFiltro(EV), l=cuentan(todos), c=k=>todos.filter(e=>e.estatus===k).length;
  const hoy=new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
  const filtros=activeFilters().filter(f=>!['anio','mes','dia'].includes(f[0])).map(f=>f[1]).join(', ')||'Sin filtros';
  const periodo=rsEtiqueta();
  const conEstatus=c('Descartada')>0;
  const distintos=k=>new Set(l.map(e=>e[k])).size;
  const mods=['alta','ralenti','neutral','rpm','frenado'].map(k=>{
    const M=MODS[k], base=EV.filter(e=>M.types.includes(e.tipo_evento)), lista=cuentan(rsFiltro(base));
    const vals=lista.map(e=>e[M.metric]).filter(v=>v!=null);
    const max=lista.length?lista.reduce((a,b)=>b[M.metric]>a[M.metric]?b:a):null;
    const tad=[...groupCount(lista,'tad').entries()].sort((a,b)=>b[1]-a[1])[0];
    return {M,lista,n:lista.length,max,avg:vals.length?Math.round(sum(vals)/vals.length*10)/10:0,tad,
      top:top5Conductores(lista,M),v:variacionReporte(cuentan(rsAlcance(base)))};
  });
  const rp=rsBarras(l), mx=Math.max(1,...rp.filas.map(f=>f[1]));
  const t5=[...l.filter(e=>e.tipo_evento===T.AV)].sort((a,b)=>b.velocidad_max-a.velocidad_max).slice(0,5);

  const PA=PALETAS.institucional.c, co=i=>PA[i%PA.length];   // los mismos colores que las graficas del panel
  const Z='font-family:Arial,Helvetica,sans-serif;color:#1c2a3f;font-size:12.5px;';
  const TP='role="presentation" width="100%" cellpadding="0" cellspacing="0"';   // T ya es el catalogo de tipos de evento
  /* Outlook renderiza con el motor de Word: ignora margins, border-radius, flex y los divs con altura.
     Por eso las barras son celdas con bgcolor y toda la separacion va en padding de fila/celda. */
  const barra=(p,c,h)=>{const w=Math.max(0,Math.min(100,Math.round(p||0)));
    return `<table ${TP} style="border-collapse:collapse"><tr><td width="${w}%" bgcolor="${c}" style="height:${h||10}px;font-size:1px;line-height:1px">&nbsp;</td><td bgcolor="#e6ecf5" style="height:${h||10}px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>`;};
  const tile=(lbl,val,c,s)=>`<td width="25%" valign="top" bgcolor="#fbfcfe" style="border:1px solid #dde4ef;border-top:3px solid ${c};padding:9px 11px"><div style="font-size:9.5px;color:#5c6b81;text-transform:uppercase;letter-spacing:.5px">${lbl}</div><div style="font-size:20px;font-weight:700;color:${c};padding-top:3px">${val}</div>${s?`<div style="font-size:9.5px;color:#5c6b81;padding-top:2px">${s}</div>`:''}</td>`;
  const th=a=>`style="background:#263a5c;color:#ffffff;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;text-align:${a||'left'};padding:7px 10px"`;
  const td=a=>`style="font-size:12px;padding:8px 10px;border-bottom:1px solid #e9edf4;text-align:${a||'left'};vertical-align:middle"`;
  const fila=(c,i)=>`<tr${i%2?' bgcolor="#f7f9fc"':''}>${c}</tr>`;
  const sec=(t,d)=>`<tr><td style="padding:18px 20px 8px"><table ${TP} style="border-collapse:collapse"><tr><td style="border-bottom:2px solid #263a5c;padding-bottom:5px;font-size:13px;font-weight:700;color:#263a5c">${t}</td><td align="right" valign="bottom" style="border-bottom:2px solid #263a5c;padding-bottom:5px;font-size:10.5px;color:#5c6b81">${d||''}</td></tr></table></td></tr>`;
  const cuerpo=c=>`<tr><td style="padding:0 20px">${c}</td></tr>`;
  const nDesc=c('Descartada'), excl=!S.est.length;   // excl=false cuando la persona pidio un estatus: ahi las descartadas SI cuentan
  const tiles=conEstatus
    ?[tile('Total de eventos',fmtN(l.length),'#263a5c',excl?`excluye ${fmtN(nDesc)} descartada${nDesc===1?'':'s'}`:''),tile('Conductores',fmtN(new Set(l.filter(e=>e.conductor!=='Sin conductor').map(e=>e.conductor)).size),'#2F4B7C'),tile('Descartadas',fmtN(nDesc),'#6B7A8F',excl?'no cuentan en el reporte':'filtradas en este reporte'),tile('Sin marcar',fmtN(c('Sin estatus')),'#C28A2C',excl?'sí cuentan como normales':'')]
    :[tile('Total de eventos',fmtN(l.length),'#263a5c'),tile('Conductores',fmtN(new Set(l.filter(e=>e.conductor!=='Sin conductor').map(e=>e.conductor)).size),'#2F4B7C'),tile('Unidades',fmtN(distintos('num_economico')),'#4F86C6'),tile('TAD con eventos',fmtN(distintos('tad')),'#8C2F39')];
  /* Barras del periodo: en columnas (grafica de barras verticales) caben hasta 14 marcas;
     si son muchos dias, se pasan a barras horizontales en dos columnas para no aplastar las etiquetas. */
  const columnas=(filas,c)=>{const mxv=Math.max(1,...filas.map(f=>f[1])), f=filas.slice(0,14), n=Math.max(1,f.length);
    return `<table ${TP} style="border-collapse:collapse"><tr height="76">`+f.map(([lbl,v])=>
      `<td width="${(100/n).toFixed(2)}%" valign="bottom" align="center" style="padding:0 2px"><div style="font-size:9.5px;color:#42526b;padding-bottom:3px">${v?fmtN(v):''}</div><table width="72%" align="center" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td height="${Math.max(2,Math.round(v/mxv*56))}" bgcolor="${v?c:'#e6ecf5'}" style="font-size:1px;line-height:1px">&nbsp;</td></tr></table></td>`).join('')+
      `</tr><tr>`+f.map(([lbl])=>`<td align="center" style="font-size:9.5px;color:#5c6b81;border-top:1px solid #cfd8e6;padding:5px 1px 0">${esc(lbl)}</td>`).join('')+`</tr></table>`+
      (filas.length>14?`<div style="font-size:10.5px;color:#5c6b81;padding-top:5px">Se muestran las 14 primeras marcas de ${filas.length}.</div>`:'');};
  const barras2=(filas,mx,c)=>{const h=Math.ceil(filas.length/2);
    return `<table ${TP} style="border-collapse:collapse">`+filas.slice(0,h).map((x,j)=>{const y=filas[j+h];
      const cel=z=>z?`<td width="54" align="right" style="font-size:10.5px;color:#42526b;padding:3px 6px 3px 0">${esc(z[0])}</td><td>${barra(z[1]/mx*100,c,8)}</td><td width="44" style="font-size:10.5px;padding:3px 0 3px 6px"><b>${fmtN(z[1])}</b></td>`
                   :`<td width="54"></td><td></td><td width="44"></td>`;
      return `<tr>${cel(x)}${cel(y)}</tr>`;}).join('')+`</table>`;};
  const dist=(rp2,c)=>{const mx2=Math.max(1,...rp2.filas.map(f=>f[1]));
    return rp2.filas.length<=14?columnas(rp2.filas,c):barras2(rp2.filas,mx2,c);};
  const tot=mods.reduce((a,m)=>a+m.n,0)||1;
  const pila=`<table ${TP} style="border-collapse:collapse"><tr>`+mods.map((m,i)=>m.n?`<td width="${(m.n/tot*100).toFixed(2)}%" bgcolor="${co(i)}" style="height:14px;font-size:1px;line-height:1px">&nbsp;</td>`:'').join('')+`</tr></table>`;
  const leyenda=`<table ${TP} style="border-collapse:collapse">`+[0,3].map(k=>`<tr>`+mods.slice(k,k+3).map((m,i)=>`<td width="33%" style="padding:6px 10px 0 0"><table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td width="10" bgcolor="${co(k+i)}" style="height:9px;font-size:1px;line-height:1px">&nbsp;</td><td style="padding-left:6px;font-size:11px;color:#42526b">${esc(m.M.title)} <b>${fmtN(m.n)}</b> · ${Math.round(m.n/tot*100)}%</td></tr></table></td>`).join('')+`</tr>`).join('')+`</table>`;
  const filasMod=mods.map((m,i)=>m.n?fila(`<td ${td()}><table ${TP} style="border-collapse:collapse"><tr><td width="8" bgcolor="${co(i)}" style="height:14px;font-size:1px;line-height:1px">&nbsp;</td><td style="padding-left:8px;font-size:12px"><b>${esc(m.M.title)}</b></td></tr></table></td><td ${td('right')}><b>${fmtN(m.n)}</b><div style="font-size:10px;color:#5c6b81">${Math.round(m.n/tot*100)}% del reporte</div></td><td width="120" style="padding:8px 10px;border-bottom:1px solid #e9edf4">${barra(m.n/tot*100,co(i),9)}</td><td ${td('left')}>${m.v.txt?`<span style="color:${m.v.color};font-size:11px">${esc(m.v.txt)}</span>`:'<span style="color:#5c6b81;font-size:11px">—</span>'}</td><td ${td('right')}><b>${fval(m.M,m.max[m.M.metric])}</b><div style="font-size:10px;color:#5c6b81">${esc(m.max.conductor)}</div></td><td ${td('right')}>${fval(m.M,m.avg)}</td><td ${td()}>${m.tad?esc(m.tad[0])+'<div style="font-size:10px;color:#5c6b81">'+fmtN(m.tad[1])+' eventos</div>':'—'}</td>`,i)
    :fila(`<td ${td()}><span style="color:#5c6b81">${esc(m.M.title)}</span></td><td ${td('right')} colspan="6" style="font-size:12px;color:#5c6b81;padding:8px 10px;border-bottom:1px solid #e9edf4">Sin eventos para los filtros seleccionados</td>`,i)).join('');
  /* Bloque por modulo: cabecera con sus cifras, tabla top 5 con barra y porcentaje, y la grafica del periodo. */
  const bloqueMod=(m,i)=>{
    if(!m.n) return '';
    const rp2=rsBarras(m.lista);
    const filas=m.top.length?m.top.map((r,j)=>`<tr${j%2?' bgcolor="#f7f9fc"':''}>
      <td width="26" align="center" bgcolor="${j<3?co(i):'#eef2f8'}" style="font-size:11px;font-weight:700;color:${j<3?'#ffffff':'#42526b'};padding:8px 0;border-bottom:1px solid #e9edf4">${j+1}</td>
      <td ${td()}><b>${esc(r.con)}</b><div style="font-size:10px;color:#5c6b81;padding-top:2px">${esc(r.tad)} · ${r.unidades} unidad${r.unidades===1?'':'es'}${r.max!=null?' · máx '+fval(m.M,r.max):''}</div></td>
      <td width="150" style="padding:8px 10px;border-bottom:1px solid #e9edf4">${barra(r.n/m.top[0].n*100,co(i),9)}</td>
      <td width="58" ${td('right')}><b>${fmtN(r.n)}</b></td>
      <td width="54" ${td('right')}><span style="font-size:11px;color:#42526b">${Math.round(r.n/m.n*100)}%</span></td></tr>`).join('')
      :`<tr><td ${td()} colspan="5" style="font-size:12px;color:#5c6b81;padding:8px 10px">Sin conductores asignados en este módulo.</td></tr>`;
    return `<table ${TP} style="border-collapse:collapse;border:1px solid #dde4ef">
      <tr><td bgcolor="${co(i)}" style="padding:9px 12px"><table ${TP} style="border-collapse:collapse"><tr>
        <td style="font-size:13px;font-weight:700;color:#ffffff">${esc(m.M.title)}</td>
        <td align="right" valign="middle" style="font-size:10.5px;color:#e8eef7">${fmtN(m.n)} eventos · ${Math.round(m.n/tot*100)}% del reporte · máx ${fval(m.M,m.max[m.M.metric])} · prom ${fval(m.M,m.avg)}${m.tad?' · líder '+esc(m.tad[0]):''}</td></tr></table></td></tr>
      <tr><td style="padding:10px 12px 2px"><table ${TP} style="border-collapse:collapse">
        <tr><td width="26" ${th('center')}>#</td><td ${th()}>Conductor</td><td width="150" ${th()}>Frecuencia</td><td width="58" ${th('right')}>Eventos</td><td width="54" ${th('right')}>%</td></tr>
        ${filas}</table></td></tr>
      <tr><td style="padding:12px"><table ${TP} style="border-collapse:collapse"><tr><td style="font-size:9.5px;color:#5c6b81;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e9edf4;padding-bottom:4px">${esc(rp2.tit)}</td><td align="right" style="font-size:9.5px;color:#5c6b81;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e9edf4;padding-bottom:4px">total ${fmtN(m.n)}</td></tr></table>${dist(rp2,co(i))}</td></tr>
    </table>`;
  };
  const bloques=mods.map(bloqueMod).join(`<table ${TP} style="border-collapse:collapse"><tr><td style="height:14px;font-size:1px">&nbsp;</td></tr></table>`);
  const mxv=Math.max(1,...t5.map(e=>e.velocidad_max||0));
  const filasTop=t5.length?t5.map((e,i)=>fila(`<td width="26" align="center" bgcolor="${i<3?'#B3392F':'#eef2f8'}" style="font-size:11px;font-weight:700;color:${i<3?'#ffffff':'#42526b'};padding:8px 0;border-bottom:1px solid #e9edf4">${i+1}</td><td ${td()}>${esc(e.conductor)}<div style="font-size:10px;color:#5c6b81;padding-top:2px">${esc(e.tad)} · ${esc(e.num_economico||'')}</div></td><td ${td()}>${e.dia} ${esc(MES3[e.mes])} · ${esc(e.hora)}</td><td width="150" style="padding:8px 10px;border-bottom:1px solid #e9edf4">${barra((e.velocidad_max||0)/mxv*100,'#B3392F',9)}</td><td width="76" ${td('right')}><b style="color:#8C2F39">${e.velocidad_max} km/h</b></td>`,i)).join('')
    :fila(`<td ${td()} colspan="5" style="font-size:12px;color:#5c6b81;padding:8px 10px">Sin eventos de alta velocidad para el periodo y filtros elegidos.</td>`,0);
  const html=`<table id="repBody" ${TP} style="${Z}border-collapse:collapse;width:100%;max-width:680px;border:1px solid #dde4ef;background:#ffffff">
<tr><td bgcolor="#263a5c" style="padding:16px 20px"><table ${TP} style="border-collapse:collapse"><tr>
  <td style="font-size:17px;font-weight:700;color:#ffffff">Reporte Alertas Traffilo </td>
  <td align="right" valign="bottom" style="font-size:10px;color:#c9d6e7;text-transform:uppercase;letter-spacing:.6px">PEMEX · OnCommand</td></tr>
<tr><td colspan="2" style="font-size:11.5px;color:#d5dded;padding-top:6px">${esc(periodo)} · ${esc(hoy)}</td></tr>
<tr><td colspan="2" style="font-size:11px;color:#aebfd8;padding-top:2px">Filtros: ${esc(filtros)}</td></tr></table></td></tr>
<tr><td style="padding:0"><table ${TP} style="border-collapse:collapse"><tr>${[0,1,2,3,4].map(k=>`<td width="20%" bgcolor="${co(k)}" style="height:4px;font-size:1px;line-height:1px">&nbsp;</td>`).join('')}</tr></table></td></tr>
${cuerpo(`<table ${TP} style="border-collapse:collapse;margin:0"><tr>${tiles.join('')}</tr></table>`)}
${sec('Composición del reporte',`${fmtN(tot)} eventos en los 5 módulos`)}
${cuerpo(pila+leyenda)}
${sec('Resumen por módulo','variación contra el mes anterior')}
${cuerpo(`<table ${TP} style="border-collapse:collapse"><tr><td width="150" ${th()}>Módulo</td><td width="86" ${th('right')}>Eventos</td><td width="118" ${th()}>Variación</td><td width="96" ${th('right')}>Máximo</td><td width="84" ${th('right')}>Promedio</td><td ${th()}>TAD con más eventos</td></tr>${filasMod}</table>`)}
${sec(rp.tit,`escala: ${fmtN(mx)} eventos`)}
${cuerpo(dist(rp,mx))}
${sec('Por módulo · top 5 conductores y distribución del periodo','los 5 con más eventos')}
${cuerpo(bloques||`<table ${TP} style="border-collapse:collapse"><tr><td style="font-size:12px;color:#5c6b81">Sin eventos para el periodo y filtros seleccionados.</td></tr></table>`)}
${sec('Top 5 · Alta velocidad','ordenado por velocidad máxima')}
${cuerpo(`<table ${TP} style="border-collapse:collapse"><tr><td width="26" ${th('center')}>#</td><td ${th()}>Conductor / TAD</td><td width="130" ${th()}>Fecha y hora</td><td width="150" ${th()}>Velocidad</td><td width="76" ${th('right')}>km/h</td></tr>${filasTop}</table>`)}
<tr><td bgcolor="#f4f7fb" style="padding:11px 20px;border-top:1px solid #dde4ef;font-size:10.5px;color:#5c6b81">Monitor de Conducción TAD · ${fmtN(EV.length)} eventos en la base · periodo del reporte ${fmtN(l.length)} · ${esc(hoy)}</td></tr>
</table>`;

  const lineas=mods.flatMap(m=>m.n
    ?[`${m.M.title.toUpperCase()}: ${fmtN(m.n)} eventos | Máx ${fval(m.M,m.max[m.M.metric])} (${m.max.conductor}, ${m.max.tad}) | Prom ${fval(m.M,m.avg)} | Más eventos: ${m.tad[0]} (${fmtN(m.tad[1])})${m.v.txt?' | '+m.v.txt:''}`,
      m.top.length?`   Top 5 conductores: ${m.top.map(t=>`${t.con} (${fmtN(t.n)})`).join(' · ')}`:null].filter(Boolean)
    :[`${m.M.title.toUpperCase()}: sin eventos`]);
  const texto=[`REPORTE · MONITOR DE CONDUCCIÓN TAD`,`${periodo} · ${hoy}`,`Filtros: ${filtros}`,'',
    `GENERAL: ${fmtN(l.length)} eventos`+(conEstatus&&excl?` (sin contar ${fmtN(nDesc)} descartada${nDesc===1?'':'s'})`:''),'',...lineas].join('\n');
  REPORTE={html:aisla(html),texto};
  return REPORTE;
}

/* Cambiar el periodo solo repinta la barra y la vista previa: los destinatarios no se tocan. */
function pintaReporte(){
  const b=document.getElementById('rsBar'), c=document.getElementById('repLienzo');
  if(!b||!c) return;
  b.innerHTML=rsBarra();
  c.innerHTML=construirReporte().html;
  repAjusta();
  pintaAdjuntos();                                            // la lista de Excel sigue al periodo elegido
}

/* ---- Vista previa: que el reporte ENTRE COMPLETO en el modal ----
   El diseno mide 680 px (lo que cabe en la hoja del correo). Si el modal es mas angosto el reporte
   no se recorta: se encoge con transform:scale hasta que entra, así se ve igual que en el correo.
   REP_ZOOM = null significa "auto" (se adapta solo); un numero es el tamano que fijo la persona.
   Ninguno de estos cambios toca el HTML que se copia ni el que manda Outlook: es solo la caja. */
const REP_ANCHO=680;
let REP_ZOOM=null, REP_K=1, REP_RO=null, REP_W=0;
function repAjusta(){
  const caja=$('#repCuerpo'), lienzo=$('#repLienzo'), marco=$('#repMarco');
  if(!caja||!lienzo||!marco) return;
  const cs=getComputedStyle(caja);
  const disponible=caja.clientWidth-parseFloat(cs.paddingLeft||0)-parseFloat(cs.paddingRight||0);
  const k=Math.max(.3,Math.min(2, REP_ZOOM==null?Math.min(1,disponible/REP_ANCHO):REP_ZOOM));
  REP_K=k; REP_W=caja.clientWidth;
  lienzo.style.transform='scale('+k+')';
  marco.style.width=Math.round(REP_ANCHO*k)+'px';
  marco.style.height=Math.round(lienzo.offsetHeight*k)+'px';
  const z=$('#repZoomTxt'); if(z) z.textContent=Math.round(k*100)+'%';
}
function repZoom(paso){
  if(paso==='auto') REP_ZOOM=null;
  else if(paso==='real') REP_ZOOM=1;
  else REP_ZOOM=Math.max(.3,Math.min(2,Math.round(((REP_ZOOM==null?REP_K:REP_ZOOM)+parseFloat(paso))*100)/100));
  repAjusta();
}
function repAncho(){                                          // modal ancho = ver el reporte a tamano real
  const m=$('#modal'); if(!m) return;
  m.classList.toggle('ancha');
  const b=document.querySelector('[data-act="repwide"]');
  if(b) b.textContent=m.classList.contains('ancha')?'Ajustar al panel':'Ancho completo';
  repAjusta();
}
function repObserva(){                                        // si el modal o la ventana cambian de ancho, se vuelve a medir
  const caja=$('#repCuerpo'); if(!caja) return;
  if(REP_RO) REP_RO.disconnect();
  if(window.ResizeObserver){ REP_RO=new ResizeObserver(e=>{if(e[0].contentRect.width!==REP_W) repAjusta();}); REP_RO.observe(caja); }
  else window.addEventListener('resize',repAjusta);
  repAjusta(); requestAnimationFrame(repAjusta);
}

/* ---- Adjuntos: los Excel de la carpeta de Entrada que corresponden al periodo del reporte ----
   El navegador no puede adjuntar, así que el servidor local resuelve los meses contra CARPETA_ENTRADA. */
let ADJ=null;                                                  // ultima respuesta de /adjuntos (null = no hay servidor)
const claveMes=k=>{const i=DATOS.meses.findIndex(m=>m.key===k);return i<0?k:MESES[i];};
function repClaves(){                                          // ['2026-01', ...] de los eventos que salen en el reporte
  const ks=l=>[...new Set(l.map(e=>e.mes))].sort((a,b)=>a-b).map(i=>DATOS.meses[i].key);
  const con=ks(rsFiltro(EV_ALL));
  return con.length?con:ks(rsAlcance(EV_ALL));                 // periodo sin eventos: se adjunta el alcance por meses
}
function adjResumen(j){
  const adj=j.adjuntos||[];
  if(!adj.length) return j.carpeta_existe===false
    ? `<span class="adj-x">La carpeta de Entrada no existe en este equipo: <b>${esc(j.carpeta||'')}</b>. Ajusta CARPETA_ENTRADA en Backend\\.env o conecta la unidad donde esta Drive.</span>`
    : `<span class="adj-x">No hay Excel de este periodo en <b>${esc(j.carpeta||'la carpeta de Entrada')}</b> ni en su carpeta Historial.</span>`;
  const falt=(j.faltan||[]).map(claveMes);
  return adj.map(n=>`<span class="adj-file">${ico('cal',13)} ${esc(n)}</span>`).join('')+
    (falt.length?`<span class="adj-x">Sin archivo para ${esc(falt.join(', '))}.</span>`:'')+
    /* Outlook de escritorio adjunta solo; el correo web no puede, asi que este boton deja la carpeta
       abierta y el Excel se arrastra a la ventana del mensaje. No se guarda ni se copia nada. */
    `<button class="adj-btn" data-act="abrirentrada" type="button" title="Abre el Explorador en la carpeta de Entrada">${ico('cal',13)} Mostrar la carpeta de estos Excel (arastre el archivo al correo web si Outlook no abre)</button>`;
}
function pintaAdjuntos(){
  const b=$('#rsAdj'); if(!b) return;
  b.innerHTML='<span class="adj-x">Buscando los Excel del periodo…</span>';
  fetch('/adjuntos?meses='+encodeURIComponent(repClaves().join(',')),{cache:'no-store'})
    .then(r=>r.ok?r.json():Promise.reject())
    .then(j=>{ADJ=j;b.innerHTML=adjResumen(j);})
    .catch(()=>{ADJ=null;
      b.innerHTML='<span class="adj-x">Sin servidor local: no se puede leer la carpeta de Entrada. Abre el panel con <b>ABRIR_DASHBOARD.bat</b> para que Outlook adjunte los Excel.</span>';});
}

function openMail(){
  rsPodar();
  const R=construirReporte();
  REP_ZOOM=null;                                              // cada vez que se abre el modal, la vista vuelve a adaptarse sola
  $('#modal').classList.remove('ancha');
  $('#modal').innerHTML=`<div class="mh"><h3>Enviar reporte por correo</h3><button class="btn sm" data-act="closeAll" aria-label="Cerrar">${ico('x',16)}</button></div>
  <div class="mb">
    <label style="font-size:12px;color:var(--muted)">Destinatarios</label>
    <input type="text" id="mailTo" value="" placeholder="correo1@empresa.com; correo2@empresa.com" aria-label="Destinatarios">
    <div class="rs" id="rsBar">${rsBarra()}</div>
    <div class="rep-tools">
      <button class="btn sm" type="button" data-act="repzoom" data-k="-0.1" title="Reducir solo la vista previa">−</button>
      <span class="rep-zoom" id="repZoomTxt">100%</span>
      <button class="btn sm" type="button" data-act="repzoom" data-k="0.1" title="Ampliar solo la vista previa">+</button>
      <button class="btn sm" type="button" data-act="repzoom" data-k="auto">Completo</button>
      <button class="btn sm" type="button" data-act="repzoom" data-k="real">Tamaño real</button>
      <button class="btn sm" type="button" data-act="repwide">Ancho completo</button>
      <span class="rep-nota">Estos botones cambian <b>solo la pantalla</b>: el correo siempre sale al tamaño completo.</span>
    </div>
    <div id="repCuerpo" class="rep-cuerpo"><div id="repMarco" class="rep-marco"><div id="repLienzo" class="rep-lienzo">${R.html}</div></div></div>
    <label class="adj-box"><input type="checkbox" id="mailAdj" checked> Adjuntar el Excel del periodo (carpeta de Entrada)</label>
    <div id="rsAdj" class="adj-lista"></div>
    <div id="mailAviso" class="mail-aviso"></div>
    <p class="hint" style="margin:12px 0 0">Elige el periodo arriba: en <b>Por mes</b> se marcan los meses; en <b>Por día</b> la fila de meses decide el alcance y la fila de días solo muestra los días con eventos de esos meses. Cada módulo trae su tabla de los 5 conductores con más eventos y sus barras del periodo. <b>Outlook</b> abre el mensaje con este diseño y los Excel de esos meses ya adjuntados. Para pegarlo a mano: <b>Copiar con diseño</b> y Ctrl+V en el correo que abras.</p>
  </div>
  <div class="mf" style="flex-wrap:wrap"><button class="btn" data-act="closeAll">Cancelar</button><button class="btn" data-act="copyrep">${ico('copy',16)} Copiar con diseño</button><button class="btn green" data-act="sendmail" data-via="outlook">Outlook</button></div>`;
  lastFocus=document.activeElement;
  $('#modal').classList.add('on');$('#overlay').classList.add('on');
  $('#mailTo').focus();
  repObserva();
  pintaAdjuntos();
}
