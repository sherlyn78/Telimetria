/* 04_vistas: vistas: General, modulos, comparador y detalle */
const DIMS={
  tad:{n:'TAD',key:e=>e.tad},
  conductor:{n:'Conductor',key:e=>e.conductor},
  unidad:{n:'Núm. económico',key:e=>e.num_economico},
  tipo:{n:'Tipo de evento',key:e=>e.tipo_evento},
  clasif:{n:'Clasificación',key:e=>e.clasif||e.conductor},
  estatus:{n:'Estatus',key:e=>e.estatus},
  mes:{n:'Mes',chrono:true},
  fecha:{n:'Día',chrono:true},
  hora:{n:'Hora del día',chrono:true}
};
const SPLITS={estatus:e=>e.estatus,tipo:e=>e.tipo_evento,tad:e=>e.tad,clasif:e=>e.clasif||e.conductor};
const ORDEN_ESTATUS=['Descartada','Sin estatus'];
/* Columnas de la tabla de detalle. Cada modulo elige las suyas en MODS[x].cols (01_config.js).
   `k` es la propiedad con la que se ordena. Duracion y velocidad ordenan por su propio campo:
   en Ralentí y RPM las dos columnas van en la misma tabla y `valor` solo trae la metrica del modulo. */
const COLS={
  conductor:{h:'Conductor',k:'conductor',c:r=>`<b>${esc(r.conductor)}</b>`,x:r=>r.conductor},
  asig:{h:'Asignación',k:'conductor',c:r=>`<b>${esc(r.conductor)}</b>`,x:r=>r.conductor},
  clasif:{h:'Clasificación',k:'clasif',c:r=>esc(r.clasif||'—'),x:r=>r.clasif},
  unidad:{h:'Núm. económico',k:'num_economico',c:r=>esc(r.num_economico),x:r=>r.num_economico},
  tad:{h:'TAD',k:'tad',c:r=>esc(r.tad),x:r=>r.tad},
  mes:{h:'Mes',k:'mes',c:r=>MES3[r.mes],x:r=>MES3[r.mes]},
  dia:{h:'Día',k:'dia',c:r=>r.dia,x:r=>r.dia},
  hora:{h:'Hora',k:'hora',c:r=>r.hora,x:r=>r.hora},
  tipo:{h:'Tipo de evento',k:'tipo_evento',c:r=>esc(r.tipo_evento),x:r=>r.tipo_evento},
  vel:{h:'Velocidad (km/h)',k:'velocidad_max',c:r=>r.velocidad_max?r.velocidad_max+' km/h':'—',x:r=>r.velocidad_max,cls:'num'},
  dur:{h:'Duración (HH:MM:SS)',k:'duracion_min',c:r=>r.duracion_min!=null?fhora(r.duracion_min):'—',x:r=>r.duracion_min,cls:'num'},
  med:{h:'Medición',k:'med',c:r=>esc(r.med),x:r=>r.med,cls:'num'},
  estatus:{h:'Estatus',k:'estatus',c:r=>celdaEstatus(r),x:r=>r.estatus},
  motivo:{h:'Motivo',k:'motivo',c:r=>celdaMotivo(r),x:r=>r.motivo},
  protocolo:{h:'Protocolo',k:'protocolo',c:r=>celdaProtocolo(r),x:r=>r.protocolo?'Sí':'No'}
};
/* La columna Protocolo (casilla si/no, subir y consultar) va al final de TODAS las tablas de eventos,
   sin escribirla en la lista de cada modulo; si un modulo ya la trae, no se repite. */
const colsMod=()=>{
  const base=MODS[S.mod].cols||['conductor','unidad','tad','mes','dia','hora','tipo','vel','estatus','motivo'];
  return base.concat(base.includes('protocolo')?[]:['protocolo']).map(k=>COLS[k]);
};
const _fechas=EV_ALL.map(e=>e.fecha).sort(), FECHA_MIN=_fechas[0]||'', FECHA_MAX=_fechas[_fechas.length-1]||'';

/* Eje horizontal de la gráfica: los ejes de tiempo se rellenan con ceros (como en Excel). */
function ejeGrafica(dimK,list){
  if(dimK==='mes'){
    const ks=S.mes.length?S.mes.map(Number).sort((a,b)=>a-b):MES3.map((_,i)=>i);
    return {keys:ks,labels:ks.map(i=>MESES[i]),keyOf:e=>e.mes};
  }
  if(dimK==='hora'){
    const ks=S.hora.length?S.hora.map(Number).sort((a,b)=>a-b):Array.from({length:24},(_,i)=>i);
    return {keys:ks,labels:ks.map(h=>String(h).padStart(2,'0')+':00'),keyOf:e=>e.h};
  }
  if(dimK==='fecha'){
    const meses=(S.mes.length?S.mes.map(Number):DATOS.meses.map((_,i)=>i)).sort((a,b)=>a-b), ks=[], lb=[];
    meses.forEach(mi=>{
      const mk=DATOS.meses[mi].key, y=+mk.slice(0,4), m=+mk.slice(5,7);
      if(S.anio.length&&!S.anio.some(a=>+a===y)) return;
      const nd=new Date(y,m,0).getDate();
      for(let d=1;d<=nd;d++){
        if(S.dia.length&&!S.dia.some(x=>+x===d)) continue;
        const f=mk+'-'+String(d).padStart(2,'0');
        if(f<FECHA_MIN||f>FECHA_MAX) continue;
        ks.push(f); lb.push(String(d).padStart(2,'0')+'-'+MES3[mi]);
      }
    });
    return {keys:ks,labels:lb,keyOf:e=>e.fecha};
  }
  const key=DIMS[dimK].key;
  let ks=[...new Set(list.map(key))];
  ks=dimK==='estatus'?ORDEN_ESTATUS.filter(k=>ks.includes(k)).concat(ks.filter(k=>!ORDEN_ESTATUS.includes(k))):ks.sort((a,b)=>String(a).localeCompare(String(b),'es'));
  return {keys:ks,labels:ks.map(String),keyOf:key};
}
function valorGrupo(arr,medida,M){
  if(medida==='count'||!M) return arr.length;
  const v=arr.map(e=>e[M.metric]).filter(x=>x!=null);
  if(!v.length) return 0;
  return medida==='avg'?Math.round(sum(v)/v.length*10)/10:Math.max(...v);
}
function subtituloGrafica(){
  const f=activeFilters().filter(x=>x[0]!=='tad'||S.mod!=='comparador').map(x=>x[1]);
  return f.length?f.join('  ·  '):RANGO_LARGO;
}
/* Convierte la lista filtrada en {labels, series} según lo elegido en el panel "Datos" de la gráfica. */
function datosGrafica(list,cfg,M){
  const dim=DIMS[cfg.groupBy]||DIMS.tad, ax=ejeGrafica(cfg.groupBy,list), idx=new Map(ax.keys.map((k,i)=>[k,i]));
  const splitFn=cfg.split!=='none'?SPLITS[cfg.split]:null;
  let nombres=[null];
  if(splitFn){
    const c=new Map(); list.forEach(e=>c.set(splitFn(e),(c.get(splitFn(e))||0)+1));
    nombres=cfg.split==='estatus'?ORDEN_ESTATUS.filter(k=>c.has(k)).concat([...c.keys()].filter(k=>!ORDEN_ESTATUS.includes(k))):[...c.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  }
  const cub=nombres.map(()=>ax.keys.map(()=>[]));
  list.forEach(e=>{const i=idx.get(ax.keyOf(e)); if(i==null) return; cub[splitFn?nombres.indexOf(splitFn(e)):0][i].push(e);});
  const metricName=M&&M.metric==='duracion_min'?'duración':'velocidad';
  const nomSerie=cfg.measure==='count'?'Eventos':cfg.measure==='avg'?`Promedio (${M.unit})`:`Máximo (${M.unit})`;
  const series=nombres.map((nm,s)=>({name:nm==null?nomSerie:String(nm),values:cub[s].map(a=>valorGrupo(a,cfg.measure,M))}));
  const sujeto=M?M.noun:'eventos', dn=dim.n==='TAD'?'TAD':dim.n.toLowerCase();
  const titulo=cfg.measure==='count'?(M?`Eventos de ${sujeto} por ${dn}`:`Eventos por ${dn}`)
    :`${cfg.measure==='avg'?'Promedio':'Máximo'} de ${metricName} de ${sujeto} por ${dn}`;
  const out={labels:ax.labels,keys:ax.keys,series,title:titulo,subtitle:subtituloGrafica(),xTitle:dim.n,
    yTitle:cfg.measure==='count'?'Cantidad de eventos':`${metricName[0].toUpperCase()+metricName.slice(1)} (${M?M.unit:''})`,unit:cfg.measure==='count'||!M?'':' '+M.unit};
  if(M&&cfg.measure==='count'&&!splitFn){
    out.y2={name:`Promedio de ${metricName} (${M.unit})`,title:`Promedio de ${metricName} (${M.unit})`,unit:' '+M.unit,values:cub[0].map(a=>valorGrupo(a,'avg',M))};
  }
  return out;
}
const porDimDefecto=k=>({order:DIMS[k].chrono?'natural':'desc',top:(k==='conductor'||k==='unidad')?10:0});
function alternar(k,v){S[k]=S[k].length===1&&String(S[k][0])===String(v)?[]:[v];S.page=1;refresh();}
/* Clic en una barra: filtra por ese TAD / mes / hora / tipo, o abre el boletín del conductor.
   En el tiempo ademas baja de nivel (llevarEje, 2026-11-04): tocar un MES deja la grafica con los
   DIAS de ese mes en el eje y tocar un DIA la deja con las 24 HORAS del dia. Al bajar a dias se sueltan
   los dias que estuvieran prendidos de antes, y al bajar a horas la hora previa, porque si no el eje
   nuevo saldria con una sola barra y es justo lo que se veia vacio. Segundo clic sobre la misma barra
   de mes: se quita el mes y la grafica regresa a meses. */
function clicGrafica(dim,key,st){
  if(dim==='tad') return alternar('tad',key);
  if(dim==='conductor') return openBulletin(key);
  if(dim==='mes'){const suelta=S.mes.length===1&&String(S.mes[0])===String(key);
    S.mes=suelta?[]:[key];if(!suelta)S.dia=[];S.page=1;
    llevarEje(st,suelta?'mes':'fecha');return refresh();}
  if(dim==='hora') return alternar('hora',key);
  if(dim==='tipo') return alternar('tipo',key);
  if(dim==='fecha'){const mi=DATOS.meses.findIndex(m=>m.key===key.slice(0,7));
    S.mes=[mi];S.dia=[+key.slice(8)];S.hora=[];S.page=1;
    llevarEje(st,'hora');return refresh();}
}
/* El recado del tooltip cambia segun el nivel en el que esta la grafica, para que el descenso se
   descubra sola: en meses dice "ver los dias", en dias "ver las horas". */
const PISTA_CLIC=k=>k==='mes'?'Clic para ver los días de este mes':k==='fecha'?'Clic para ver las horas de este día':'Clic para filtrar por este valor';
/* Tipos con eventos de conductor (los de no conductor van en su propio modulo). Mismo orden en botones y desglose. */
const TIPOS_GENERAL=ALL_TIPOS.filter(t=>EV.some(e=>e.tipo_evento===t));
function kpi({label,value,sub,icon,color,extra='',txt=false,key=''}){
  /* La de protocolos se selecciona: abre la ventana de quién subió y quién no (10_resumen_protocolo.js). */
  const clk=key==='prot'?' role="button" tabindex="0" title="Selecciona la tarjeta para ver quién subió protocolo, quién solo lo marcó y quién ninguno"':'';
  return `<div class="card kpi${key==='prot'?' clic':''}" data-kpi="${key}"${clk} style="--c:${color}"><div class="l">${label}</div><div class="v${txt?' txt':''}">${value}</div><div class="s">${sub||''}</div>${extra}<span class="ic">${ico(icon,24)}</span></div>`;
}
/* La lista que tiene cada vista a la vista. La tarjeta de protocolos la necesita para poder mover su
   numero en cuanto se palomea una casilla, sin recomponer toda la pagina (quien marca varios seguidos
   no pierde su lugar en la tabla). */
let LISTA_VISTA=[];
const apuntarLista=l=>{LISTA_VISTA=l;};
function actualizarTarjetaProtocolo(){
  prsRefresca();                       /* si la ventana de protocolos está abierta, va al día (10_resumen_protocolo) */
  const k=$('.kpi[data-kpi="prot"]'); if(!k) return;
  const prot=LISTA_VISTA.filter(e=>e.protocolo).length, arch=LISTA_VISTA.filter(archSubido).length;
  k.querySelector('.v').textContent=prot;
  k.querySelector('.s').textContent=`${arch} ${arch===1?'archivo subido':'archivos subidos'}`;
}
const pctDesc=(d,t)=>!t?0:d/t<.01&&d?'<1%':Math.round(d/t*100)+'%';
function variation(base,fn){
  const l=applyF(base,['mes']);
  const ref=S.mes.length?Math.max(...S.mes.map(Number)):(l.length?Math.max(...l.map(e=>e.mes)):MES3.length-1), pv=ref-1;
  if(pv<0) return '';
  const a=fn(l.filter(e=>e.mes===ref)), b=fn(l.filter(e=>e.mes===pv));
  if(!b) return `<span class="var flat">Sin datos en ${MES3[pv]}</span>`;
  const p=Math.round((a-b)/b*100);
  if(p===0) return `<span class="var flat">= igual que ${MES3[pv]}</span>`;
  return `<span class="var ${p>0?'up':'down'}">${p>0?'▲':'▼'} ${Math.abs(p)}% vs ${MES3[pv]}</span>`;
}

function viewGeneral(){
  const l=applyF(EV), lt=cuentan(l), c=k=>l.filter(e=>e.estatus===k).length;
  apuntarLista(l);
  const desc=c('Descartada'), porTad=[...groupCount(lt,'tad').entries()].sort((a,b)=>b[1]-a[1]), topTad=porTad[0]||['—',0];
  const defG={id:'general',h:360,dims:['mes','fecha','hora','tad','tipo','estatus','conductor'],quick:['mes','fecha','tad','tipo'],tipos:true,
    splits:[['none','Sin dividir'],['tipo','Tipo de evento'],['estatus','Estatus'],['tad','TAD']],measures:[['count','Cantidad de eventos']],
    types:['line','area','bar','barh','pie','doughnut'],
    /* Todas las series encendidas de entrada: cada tipo es su propia raya en cualquier dimension. */
    defaults:Object.assign({type:'line',groupBy:MES3.length>1?'mes':'fecha',split:'tipo'},porDimDefecto(MES3.length>1?'mes':'fecha')),
    hint:PISTA_CLIC,build:cfg=>datosGrafica(lt,cfg,null),onClick:(key,label,cfg,st)=>clicGrafica(cfg.groupBy,key,st)};
  studios.push(()=>mountStudio('#gs',defG));
  const cnt=(arr,ts)=>arr.filter(e=>ts.includes(e.tipo_evento)).length;
  const rows=TADS.map(t=>{const a=lt.filter(e=>e.tad===t);return {t,tot:a.length,d:l.filter(e=>e.tad===t&&e.estatus==='Descartada').length,
    av:cnt(a,MODS.alta.types),fr:cnt(a,MODS.frenado.types),ne:cnt(a,MODS.neutral.types),rp:cnt(a,MODS.rpm.types),ra:cnt(a,MODS.ralenti.types)};});
  const tot=k=>sum(rows.map(r=>r[k]));
  // el desglose ignora el propio filtro de tipo para poder comparar unos eventos con otros
  const baseTipo=applyF(EV,['tipo']), baseTipoOk=cuentan(baseTipo);
  const porTipo=TIPOS_GENERAL.map(t=>({t,n:baseTipoOk.filter(e=>e.tipo_evento===t).length,d:baseTipo.filter(e=>e.tipo_evento===t&&e.estatus==='Descartada').length})).filter(x=>x.n||x.d);
  const mxTipo=Math.max(1,...porTipo.map(x=>x.n));
  const colorear=['var(--wine)','var(--amber)','var(--green)','var(--slate)'];
  /* Protocolos: casilla marcada (realizado) y, de esos, cuantos ya traen archivo subido. */
  const protG=l.filter(e=>e.protocolo).length, archG=l.filter(archSubido).length;
  const desglose=porTipo.length?porTipo.map((x,i)=>`<div class="severity-item${S.tipo.includes(x.t)?' sel':''}" data-filtrotipo="${esc(x.t)}" role="button" tabindex="0" title="Filtrar por ${esc(x.t)}"><div class="severity-label"><span>${esc(x.t)}</span><b>${x.n}${x.d?`<small>${x.d} ${x.d===1?'descartado':'descartados'}</small>`:''}</b></div><div class="severity-track"><div class="severity-fill" style="width:${Math.round(x.n/mxTipo*100)}%;background:${colorear[i%colorear.length]}"></div></div></div>`).join(''):'<p class="panel-sub">Sin eventos con los filtros actuales.</p>';
  return `
  <div class="eyebrow"><span class="status-dot"></span> Consola de telemetría operativa</div>
  <div class="page-heading"><h2 class="page-title">Reporte General de Seguridad Vial TAD</h2><div class="head-der"><span class="period-label">${ico('clock',13)} ${RANGO_LARGO}</span></div></div><p class="page-sub">Supervisión de eventos en ruta y desempeño de las terminales de almacenamiento y despacho.</p>
  <div class="cards">
    ${kpi({label:'Total de eventos',value:lt.length,icon:'sigma',color:'var(--amber)',extra:variation(EV,a=>cuentan(a).length)})}
    ${kpi({label:'Terminales con eventos',value:porTad.length,sub:`de ${TADS.length} TAD del catálogo`,icon:'pin',color:'var(--slate)'})}
    ${kpi({label:'TAD con más eventos',value:esc(topTad[0]),sub:`${topTad[1]} eventos`,icon:'trophy',color:'var(--green)',txt:true})}
    ${kpi({label:'Descartadas',value:desc,sub:`${pctDesc(desc,l.length)} del total`,icon:'slash',color:'var(--wine)'})}
    ${kpi({label:'Protocolos realizados',value:protG,sub:`${archG} ${archG===1?'archivo subido':'archivos subidos'}`,icon:'check',color:'var(--green)',key:'prot'})}
  </div>
  <div class="general-grid"><div class="card panel">
    <div class="panel-head"><h2>Evolución de eventos</h2><span class="risk-badge">${RANGO_CORTO}</span></div>
    <div id="gs"></div>
    <div class="chart-foot">${ico('radio',14)} Consolidado de telemetría · ${lt.length} eventos registrados</div>
  </div><div class="card panel"><div class="severity-head"><h2>Desglose por tipo de evento</h2><span class="risk-badge">${desc} descartados</span></div><p class="panel-sub">Cantidad de cada evento con los filtros actuales · clic para filtrar</p><div>${desglose}</div><div class="severity-summary">${ico('alertc',17)} ${pctDesc(desc,l.length)} de los eventos está descartado (${desc} de ${l.length})</div></div></div>
  <div class="card panel table-panel">
    <div class="panel-head"><h2>Resumen operativo por terminal TAD</h2><span class="hint">${TADS.length} terminales</span></div>
    <div class="scroll"><table><thead><tr><th>TAD</th><th class="num">Total</th><th class="num">Alta vel.</th><th class="num">Ralentí</th><th class="num">Neutral</th><th class="num">RPM</th><th class="num">Frenado</th><th class="num">Descartadas</th></tr></thead>
    <tbody>${rows.map(r=>`<tr data-tadrow="${esc(r.t)}"><td><b>${esc(r.t)}</b></td><td class="num">${r.tot}</td><td class="num">${r.av}</td><td class="num">${r.ra}</td><td class="num">${r.ne}</td><td class="num">${r.rp}</td><td class="num">${r.fr}</td><td class="num val">${r.d}</td></tr>`).join('')}
    <tr><td><b>Total</b></td><td class="num"><b>${tot('tot')}</b></td><td class="num"><b>${tot('av')}</b></td><td class="num"><b>${tot('ra')}</b></td><td class="num"><b>${tot('ne')}</b></td><td class="num"><b>${tot('rp')}</b></td><td class="num"><b>${tot('fr')}</b></td><td class="num val"><b>${tot('d')}</b></td></tr></tbody></table></div><div class="table-footer">${TADS.length} terminales · ${lt.length} eventos en el período seleccionado</div>
  </div>`;
}

function medicion(e){
  if(e.duracion_min!=null) return fhora(e.duracion_min);
  if(e.velocidad_max) return e.velocidad_max+' km/h';
  return '—';
}
/* Ficha con lo que hay detras de una seleccion: quien, donde, que tipo, cuando y por que se descarto. */
function fichaNocond(l){
  const d=l.filter(e=>e.estatus==='Descartada'), s=l.filter(e=>e.estatus==='Sin estatus');
  const vel=l.length?Math.max(...l.map(e=>e.velocidad_max||0)):0;
  const durs=l.map(e=>e.duracion_min).filter(y=>y!=null);
  const stats=[['Eventos',String(l.length)],['Descartados',String(d.length)],['Sin marcar',String(s.length)],
    ['Velocidad máxima',vel?vel+' km/h':'—'],['Duración promedio',durs.length?fhora(sum(durs)/durs.length):'—']];
  const bloque=(tit,ent,attr,n)=>`<div class="fi-bloque"><h3>${tit}</h3>${ent.length?ent.slice(0,n||6).map(([k,v])=>
    `<button type="button" class="fi-it" ${attr?`data-${attr}="${esc(k)}" title="Filtrar por ${esc(k)}"`:''}><span>${esc(k)}</span><b>${v}</b></button>`).join(''):'<p class="fi-vacio">Sin registros</p>'}</div>`;
  const top=(m)=>[...m.entries()].sort((a,b)=>b[1]-a[1]);
  const gMes=groupCount(l,'mes');
  const porMes=[...gMes.entries()].sort((a,b)=>a[0]-b[0]).map(([k,v])=>[MESES[k]||('Mes '+k),v]);
  const motivos=d.filter(e=>(e.motivo||'').trim()).slice(0,6);
  const quien=S.asig.length?S.asig.join(' · '):'Todos los descartados del panel';
  return `<div class="card panel ficha">
    <div class="panel-head"><h2>Información de la selección</h2><span class="sub">${esc(quien)}</span></div>
    <div class="fi-stats">${stats.map(([k,v])=>`<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="fi-cols">
      ${bloque('Asignaciones',top(groupCount(l,'conductor')),'filtroasig')}
      ${bloque('TAD donde ocurre',top(groupCount(l,'tad')),'tadrow')}
      ${bloque('Tipos de evento',top(groupCount(l,'tipo_evento')),'filtrotipo')}
      ${bloque('Por mes',porMes,null,12)}
    </div>
    ${motivos.length?`<div class="fi-bloque fi-mot"><h3>Motivos registrados en los descartados</h3><ul>${motivos.map(e=>`<li><b>${esc(e.fecha)} · ${esc(e.conductor)}</b>${esc(e.motivo)}</li>`).join('')}</ul></div>`:''}
  </div>`;
}
function viewNocond(){
  const M=MODS.nocond;
  /* Ademas de los eventos de no conductor, caen aqui los descartados en CUALQUIER modulo: quien marca
     "Descartada" una alta velocidad quiere revisarlas todas juntas y poder desmarcarlas desde una sola pantalla. */
  const base=[...EV_NOCOND,...EV.filter(e=>e.estatus==='Descartada')];
  const list=applyF(base);
  cache.list=list;
  apuntarLista(list);
  const head=`<h2 class="page-title">${M.title}</h2><p class="page-sub">${M.sub}</p>`;
  if(!base.length) return head+`<div class="card empty"><b>No hay eventos de no conductores</b>CAPACITACIÓN, DISPONIBLE, talleres externos, técnicos ASE, TRASLADOS y los eventos sin conductor aparecen aquí cuando hay registros.</div>`;
  if(!list.length) return head+`<div class="card empty"><b>Sin eventos para los filtros seleccionados</b>Prueba con otro mes, día u hora, o quita algún filtro.<br><button class="btn green" data-act="clear">Limpiar filtros</button></div>`;
  const desc=list.filter(e=>e.estatus==='Descartada').length;
  const cuenta=cuentan(list);
  const byCl=groupCount(cuenta,'clasif');
  const topCl=[...byCl.entries()].sort((a,b)=>b[1]-a[1])[0];
  const byTad=groupCount(cuenta,'tad');
  const topTad=[...byTad.entries()].sort((a,b)=>b[1]-a[1])[0];
  const byAsig=groupCount(cuenta,'conductor');
  const top5=[...byAsig.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c])=>{
    const ej=cuenta.filter(e=>e.conductor===n)[0];
    return {conductor:n,tad:ej?ej.tad:'',n:c,clasif:ej?ej.clasif:''};
  });
  const defN={id:'mod_nocond',h:380,dims:['clasif','tad','tipo','estatus','mes','fecha','hora','unidad'],quick:['clasif','tad','tipo','mes'],
    splits:[['none','Sin dividir'],['estatus','Estatus'],['tipo','Tipo de evento'],['tad','TAD'],['clasif','Clasificación']],measures:[['count','Cantidad de eventos']],
    types:['bar','barh','line','area','pie','doughnut'],
    defaults:Object.assign({type:'bar',groupBy:'clasif'},porDimDefecto('clasif')),
    hint:PISTA_CLIC,build:cfg=>datosGrafica(cuenta,cfg,null),onClick:(key,label,cfg,st)=>cfg.groupBy==='clasif'||cfg.groupBy==='conductor'?null:clicGrafica(cfg.groupBy,key,st)};
  studios.push(()=>mountStudio('#bc',defN));
  const desglose=['Capacitación','Disponible','Taller externo','Técnico ASE','Traslados','Sin conductor'].map(k=>({k,n:byCl.get(k)||0})).filter(x=>x.n);
  /* El boton de descartados manda sobre el filtro de estatus: su conteo ignora ese filtro para que
     no desaparezca el numero al activarlo. */
  const soloDesc=soloDescartados();
  const nDesc=applyF(base,['est','asig']).filter(e=>e.estatus==='Descartada').length;
  /* La cinta sigue mostrando solo las asignaciones propias del modulo; los descartados de otros modulos
     traen nombres de conductor y la llenarian de chips. Esos se alcanzan desde la ficha de abajo. */
  const porAsig=[...groupCount(cuentan(applyF(EV_NOCOND,['asig'])),'conductor').entries()].sort((a,b)=>b[1]-a[1]);
  const cintaAsig=`<div class="asigs" role="group" aria-label="Filtrar por asignación">
    <span class="lbl">${ico('tag',13)} Filtrar por asignación</span>
    <button type="button" class="chipf" data-act="asigtodas" aria-pressed="${S.asig.length||S.est.length?'false':'true'}">Todas</button>
    <button type="button" class="chipf desc ${soloDesc?'sel':''}" data-act="sodisc" aria-pressed="${soloDesc}" title="Solo los eventos marcados como descartados, de este modulo y de los demas">Descartados<b>${nDesc}</b></button>
    ${porAsig.map(([n,c])=>`<button type="button" class="chipf ${S.asig.includes(n)?'sel':''}" data-filtroasig="${esc(n)}" aria-pressed="${S.asig.includes(n)}" title="Filtrar por ${esc(n)}">${esc(n)}<b>${c}</b></button>`).join('')}
  </div>`;
  const protN=list.filter(e=>e.protocolo).length, archN=list.filter(archSubido).length;
  const ficha=(S.asig.length||soloDesc)?fichaNocond(list):'';
  return head+`
  <div class="cards">
    ${kpi({label:M.cTotal,value:cuenta.length,sub:`${desc} ${desc===1?'descartado':'descartados'}`,icon:'sigma',color:'var(--green)',extra:variation(base,a=>cuentan(a).length)})}
    ${kpi({label:'Clasificación más frecuente',value:esc(topCl[0]||'—'),sub:`${topCl?topCl[1]:0} eventos`,icon:'tag',color:'var(--amber)',txt:true})}
    ${kpi({label:'TAD con más eventos',value:esc(topTad?topTad[0]:'—'),sub:`${topTad?topTad[1]:0} eventos`,icon:'pin',color:'var(--slate)',txt:true})}
    ${kpi({label:'Asignaciones distintas',value:byAsig.size,sub:desglose.map(x=>x.k+': '+x.n).join(' · ')||'—',icon:'grid',color:'var(--wine)'})}
    ${kpi({label:'Protocolos realizados',value:protN,sub:`${archN} ${archN===1?'archivo subido':'archivos subidos'}`,icon:'check',color:'var(--green)',key:'prot'})}
  </div>
  ${cintaAsig}
  ${ficha}
  <div class="grid2 chart-first">
    <div class="card panel"><div id="bc"></div></div>
    <div class="card panel">
      <div class="panel-head"><h2>Top 5 asignaciones con más eventos</h2></div>
      <div class="scroll"><table class="top5"><thead><tr><th>Asignación</th><th class="num">Eventos</th></tr></thead>
      <tbody>${top5.map((e,i)=>`<tr data-filtroasig="${esc(e.conductor)}" tabindex="0" title="Filtrar por ${esc(e.conductor)}"><td class="name"><div class="nwrap"><span class="rank">${i+1}</span><span class="who"><b>${esc(e.conductor)}</b><small>${esc(e.clasif)} · ${esc(e.tad)}</small></span></div></td><td class="num val">${e.n}</td></tr>`).join('')}</tbody></table></div>
    </div>
  </div>
  <div class="card panel">
    <div class="panel-head"><h2>Detalle de eventos de no conductores y descartados</h2></div>
    <div class="tools">
      <div class="search">${ico('search',16)}<input id="q" type="search" placeholder="Buscar asignación, TAD, económico, tipo…" value="${esc(S.q)}" aria-label="Buscar en el detalle"></div>
      <button class="btn sm" data-act="export" style="margin-left:auto">${ico('down',16)} Exportar a Excel</button>
    </div>
    <div id="detail"></div>
  </div>`;
}
function viewModule(){
  const M=MODS[S.mod];
  const base=EV.filter(e=>M.types&&M.types.includes(e.tipo_evento));
  const list=applyF(base);
  cache.list=list;
  apuntarLista(list);
  const head=`<h2 class="page-title">${M.title}</h2><p class="page-sub">${M.sub}</p>`;
  if(!list.length) return head+`<div class="card empty"><b>Sin eventos para los filtros seleccionados</b>Prueba con otro mes, día u hora, o quita algún filtro.<br><button class="btn green" data-act="clear">Limpiar filtros</button></div>`;

  const vals=l=>l.map(e=>e[M.metric]).filter(v=>v!=null);
  const cuenta=cuentan(list);
  const max=cuenta.length?cuenta.reduce((a,b)=>b[M.metric]>a[M.metric]?b:a):list[0];
  const avgOf=l=>{const v=vals(l);return v.length?sum(v)/v.length:0;};
  const maxOf=l=>l.length?Math.max(...vals(l)):0;
  const byTad=groupCount(cuenta,'tad');
  const topTad=[...byTad.entries()].sort((a,b)=>b[1]-a[1])[0]||['—',0];
  const desc=list.filter(e=>e.estatus==='Descartada').length;
  const prot=list.filter(e=>e.protocolo).length, archSub=list.filter(archSubido).length;

  const top5=[...cuenta].sort((a,b)=>b[M.metric]-a[M.metric]).slice(0,5);

  // gráfica (estudio con opciones de diseño)
  const metricName=M.metric==='duracion_min'?'duración':'velocidad';
  const defM={id:'mod_'+S.mod,h:380,combo:true,dims:['tad','conductor','unidad','tipo','estatus','mes','fecha','hora'],quick:['tad','conductor','mes','fecha','hora'],
    splits:[['none','Sin dividir'],['estatus','Estatus']].concat(M.types.length>1?[['tipo','Tipo de evento']]:[],[['tad','TAD']]),
    measures:[['count','Cantidad de eventos'],['avg','Promedio de '+metricName],['max','Máximo de '+metricName]],
    types:['bar','barh','line','area','pie','doughnut','combo'],
    /* En RPM arrancamos con las dos series (con pedal y sin pedal) una encima de otra y en distinto
       color; en la leyenda se prende o apaga cada una. `pila` lo trae 01_config.js. */
    defaults:Object.assign({type:M.line?'combo':'bar',groupBy:'tad'},porDimDefecto('tad'),M.pila?{split:'tipo',stacked:true}:{}),
    hint:PISTA_CLIC,build:cfg=>datosGrafica(cuenta,cfg,M),onClick:(key,label,cfg,st)=>clicGrafica(cfg.groupBy,key,st)};
  studios.push(()=>mountStudio('#bc',defM));

  return head+`
  <div class="cards">
    ${kpi({label:M.cTotal,value:cuenta.length,sub:`${desc} ${desc===1?'descartado':'descartados'}`,icon:'sigma',color:'var(--green)',extra:variation(base,a=>cuentan(a).length)})}
    ${kpi({label:M.cMax,value:kpiVal(M,max[M.metric]),sub:`${esc(max.conductor)} · ${esc(tadN(max.tad))}`,icon:'trophy',color:'var(--wine)',extra:variation(base,a=>maxOf(cuentan(a)))})}
    ${kpi({label:M.cAvg,value:kpiVal(M,Math.round(avgOf(cuenta)*10)/10),sub:`${vals(cuenta).length} mediciones`,icon:'clock',color:'var(--amber)',extra:variation(base,a=>avgOf(cuentan(a)))})}
    ${kpi({label:'TAD con más eventos',value:esc(topTad[0]),sub:`${topTad[1]} eventos`,icon:'pin',color:'var(--slate)',extra:variation(base,a=>cuentan(a).filter(e=>e.tad===topTad[0]).length),txt:true})}
    ${kpi({label:'Protocolos realizados',value:prot,sub:`${archSub} ${archSub===1?'archivo subido':'archivos subidos'}`,icon:'check',color:'var(--green)',key:'prot'})}
  </div>
  <div class="grid2 chart-first">
    <div class="card panel"><div id="bc"></div></div>
    <div class="card panel">
      <div class="panel-head"><h2>Top 5 conductores con mayor ${M.metric==='duracion_min'?'duración':'velocidad'}</h2></div>
      <div class="scroll"><table class="top5"><thead><tr><th>Conductor</th><th class="num">${M.col}</th></tr></thead>
      <tbody>${top5.map((e,i)=>`<tr data-cond="${esc(e.conductor)}" tabindex="0"><td class="name"><div class="nwrap"><span class="rank">${i+1}</span><span class="who"><b>${esc(e.conductor)}</b><small>${esc(e.tad)} · ${MES3[e.mes]} ${e.dia}, ${e.hora}</small></span></div></td><td class="num val">${fval(M,e[M.metric])}</td></tr>`).join('')}</tbody></table></div>
    </div>
  </div>
  <div class="card panel">
    <div class="panel-head"><h2>Detalle de eventos de ${M.noun}</h2></div>
    <div class="tools">
      <div class="search">${ico('search',16)}<input id="q" type="search" placeholder="Buscar conductor, TAD, económico…" value="${esc(S.q)}" aria-label="Buscar en el detalle"></div>
      <button class="btn sm" data-act="export" style="margin-left:auto">${ico('down',16)} Exportar a Excel</button>
    </div>
    <div id="detail"></div>
  </div>`;
}

function renderDetail(){
  const M=MODS[S.mod], host=$('#detail'); if(!host) return;
  const cs=colsMod(), nc=M.pool==='nocond';
  let rows=cache.list.map(e=>({...e,valor:e[M.metric]??0,med:medicion(e)}));
  const q=S.q.trim().toLowerCase();
  if(q) rows=rows.filter(r=>cs.map(c=>c.x?c.x(r):'').join(' ').toLowerCase().includes(q));
  const {k,d}=S.sort;
  rows.sort((a,b)=>{const x=a[k],y=b[k];return (typeof x==='number'?x-y:String(x).localeCompare(String(y),'es'))*d;});
  cache.rows=rows;
  const per=10, pages=Math.max(1,Math.ceil(rows.length/per));
  S.page=Math.min(Math.max(1,S.page),pages);
  const from=(S.page-1)*per, slice=rows.slice(from,from+per);
  const th=c=>`<th class="sortable ${c.cls||''}" data-act="sort" data-k="${c.k}" aria-sort="${S.sort.k===c.k?(S.sort.d>0?'ascending':'descending'):'none'}">${c.h}<span class="arr">${S.sort.k===c.k?(S.sort.d>0?'▲':'▼'):''}</span></th>`;
  const td=c=>r=>`<td class="${c.cls||''}">${c.c(r)}</td>`;
  const celdas=cs.map(td);
  host.innerHTML=`<div class="scroll"><table><thead><tr>${cs.map(th).join('')}</tr></thead>
  <tbody>${slice.length?slice.map((r,i)=>`<tr ${nc?'':`data-cond="${esc(r.conductor)}"`}>${celdas.map(f=>f(r)).join('')}</tr>`).join(''):`<tr><td colspan="${cs.length}" class="empty">Ningún evento coincide con la búsqueda.</td></tr>`}</tbody></table></div>
  <div class="pager"><span>${rows.length?`Mostrando ${from+1}–${from+slice.length} de ${rows.length}`:'0 resultados'}</span>
  <div class="b"><button class="btn sm" data-act="page" data-d="-1" ${S.page<=1?'disabled':''}>Anterior</button><span style="align-self:center">Página ${S.page} de ${pages}</span><button class="btn sm" data-act="page" data-d="1" ${S.page>=pages?'disabled':''}>Siguiente</button></div></div>`;
}

function exportCSV(){
  const M=MODS[S.mod], rows=cache.rows, cs=colsMod();
  const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const head=['Fecha'].concat(cs.map(c=>c.h),['Hora final']);
  const linea=r=>[r.fecha].concat(cs.map(c=>c.x?c.x(r):''),[r.hora_fin]);
  const csv='\ufeff'+[head.map(q).join(',')].concat(rows.map(r=>linea(r).map(q).join(','))).join('\r\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download=`eventos-${S.mod}.csv`;document.body.appendChild(a);a.click();a.remove();
  toast(`Exportado: ${rows.length} filas (se abre en Excel)`);
}

function viewComparador(){
  const isP=S.cmpMode==='periodo';
  if(!NOMBRES.includes(S.cmpA)) S.cmpA=NOMBRES[0];
  if(!NOMBRES.includes(S.cmpB)) S.cmpB=NOMBRES[1]||NOMBRES[0];
  const sel=(id,v)=>`<select data-cmp="${id}" aria-label="Elemento ${id}">${NOMBRES.map(o=>`<option ${o===v?'selected':''} value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
  /* Sin opcion "Todos": en Periodos siempre hay exactamente un mes elegido en cada lado. */
  const selMes=(id,v)=>`<select data-cmp="${id}" aria-label="Periodo ${id}">${MESES.map((m,i)=>`<option value="${i}" ${i===+v?'selected':''}>${esc(m)}</option>`).join('')}</select>`;
  if(!S.cmpMA.length) S.cmpMA=[0];
  if(!S.cmpMB.length) S.cmpMB=[MES3.length-1];
  const lblMeses=a=>a.length?a.map(Number).sort((x,y)=>x-y).map(i=>MESES[i]).join(' + '):'Todos los meses';
  /* Con muchas TAD marcadas el nombre no cabe en la cabecera de la tabla: se cuenta en vez de listar. */
  const lblTADs=a=>!a.length?'Todas las TAD':a.length<=2?a.join(' + '):a.length+' TAD agrupadas';
  let A,B,la,lb;
  /* El alcance por TAD (vacio = todas) se aplica a los dos lados. */
  const conScope=l=>l.filter(e=>inSel(S.cmpScope,e.tad));
  if(isP){
    const base=conScope(applyF(EV,['tad','mes'])), pick=a=>base.filter(e=>inSel(a,e.mes));
    A=pick(S.cmpMA); B=pick(S.cmpMB); la=lblMeses(S.cmpMA); lb=lblMeses(S.cmpMB);
  }else{
    const base=conScope(applyF(EV,['tad']));
    A=base.filter(e=>e.conductor===S.cmpA); B=base.filter(e=>e.conductor===S.cmpB);
    la=S.cmpA; lb=S.cmpB;
  }
  /* Mismo criterio que en el resto del panel: lo descartado no cuenta, pero se sigue viendo aparte. */
  const pa={todo:A,cuenta:cuentan(A)}, pb={todo:B,cuenta:cuentan(B)};
  /* Orden pedido: total, los tipos como en el menu, las mediciones y al final lo de estatus. */
  const total=['Total de eventos',x=>x.cuenta.length];
  const estatus=[['Descartadas',x=>x.todo.filter(e=>e.estatus==='Descartada').length],
    ['Sin marcar',x=>x.todo.filter(e=>e.estatus==='Sin estatus').length]];
  /* Solo los tipos que existen en la base: si un evento ya no trae datos, no llena la tabla de ceros. */
  const porTipo=TIPOS_GENERAL.map(t=>[t,x=>x.cuenta.filter(e=>e.tipo_evento===t).length]);
  const rows=[total,...porTipo,
    ['Velocidad máxima (km/h)',x=>x.cuenta.length?Math.max(...x.cuenta.map(e=>e.velocidad_max||0)):0],
    ['Duración promedio (HH:MM:SS)',x=>{const v=x.cuenta.map(e=>e.duracion_min).filter(y=>y!=null);return v.length?sum(v)/v.length:0;},fhora],
    ...estatus];
  /* Cuanto cambia B respecto de A, en porcentaje: los conteos de cada lado casi nunca son comparables en crudo. */
  const varPct=(a,b)=>{
    if(!a) return b?`<span class="var up">▲ nuevo</span>`:'<span class="var flat">—</span>';
    const p=Math.round((b-a)/a*100);
    if(!p) return '<span class="var flat">= 0%</span>';
    return `<span class="var ${p>0?'up':'down'}">${p>0?'▲':'▼'} ${Math.abs(p)}%</span>`;
  };
  /* En la grafica del comparador no va "Sin marcar": solo se lee en la tabla de arriba. */
  const graf=[total,...porTipo,...estatus.filter(r=>r[0]!=='Sin marcar')];
  const defC={id:'comparador',h:380,types:['bar','barh','line','area'],defaults:{type:'bar',order:'natural'},
    build:()=>({labels:graf.map(r=>r[0]),series:[{name:la,values:graf.map(r=>r[1](pa))},{name:lb,values:graf.map(r=>r[1](pb))}],
      title:'Comparación: '+la+' vs '+lb,subtitle:subtituloGrafica(),xTitle:'Métrica',yTitle:'Cantidad de eventos',unit:''})};
  studios.push(()=>mountStudio('#cmpg',defC));
  /* Periodos va con <select> de uno: con casillas se marcaban varios y la columna Variacion perdia sentido. */
  const ladoMes=(id,dot,v)=>`<div class="cmp-ms"><span class="${dot}"></span>${selMes(id,v)}</div>`;
  const scope=`<div class="cmp-ms cmp-ms-scope"><span class="scope-dot"></span><div class="ms" id="cmpScope"></div></div>`;
  const selecciones=(isP?ladoMes('MA','a-dot',S.cmpMA[0])+ladoMes('MB','b-dot',S.cmpMB[0]):sel('A',S.cmpA)+sel('B',S.cmpB))+scope;
  return `<h2 class="page-title">Comparador</h2><p class="page-sub">Compara dos conductores o dos periodos (por ejemplo enero contra abril). Elige primero las TAD que deben entrar o déjalo en "Todas las TAD" y luego las personas o los meses a comparar.</p>
  <div class="cmp-head"><div class="seg"><button data-act="cmpmode" data-v="cond" aria-pressed="${S.cmpMode==='cond'}">Conductores</button><button data-act="cmpmode" data-v="periodo" aria-pressed="${isP}">Periodos</button></div>${selecciones}</div>
  <div class="card cmp scroll"><table><thead><tr><th>Métrica</th><th class="a num">${esc(la)}</th><th class="b num">${esc(lb)}</th><th class="num">Variación</th></tr></thead><tbody>
  ${rows.map(([n,f,fm])=>{const a=f(pa),b=f(pb);return `<tr><td>${esc(n)}</td><td class="num ${a>b?'hi':''}">${(fm||fnum)(a)}</td><td class="num ${b>a?'hi':''}">${(fm||fnum)(b)}</td><td class="num">${varPct(a,b)}</td></tr>`;}).join('')}
  </tbody></table></div><p class="hint">El valor más alto de cada fila se resalta y <b>Variación</b> es el porcentaje que cambia ${isP?'el segundo periodo':esc(lb)} respecto de ${isP?'el primero':esc(la)} (▲ sube, ▼ baja). El alcance por TAD está en <b>${esc(lblTADs(S.cmpScope))}</b>${isP?', y en "Periodos" se elige un solo mes en cada lado':''}; respeta los filtros de día, hora y tipo de evento.</p>
  <div class="card panel cmp-graf"><div id="cmpg"></div></div>`;
}
