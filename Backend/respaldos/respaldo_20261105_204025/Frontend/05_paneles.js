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
  /* "Cara a cara" = los eventos de este conductor que ya tienen su documento de protocolo en la carpeta.
     Va aparte de la casilla: palomear sin subir el papel no cierra la platica, y el numero de la tarjeta
     de "Protocolos realizados" del panel mezcla las dos cosas. */
  const cara=ok.filter(e=>archSubido(e)).length, sinCara=ok.length-cara, marc=ok.filter(e=>e.protocolo).length;
  const celdaCara=`<div class="stat"><span title="${cara} de ${ok.length} eventos reales con protocolo subido · ${marc} con la casilla marcada">Cara a cara</span><b>${cara}</b></div>
    <div class="stat"><span title="Eventos reales de este conductor que todavia no tienen documento en la carpeta de Protocolo">Pendientes</span><b class="${sinCara?'w':''}">${sinCara}</b></div>`;
  const lista=M?[...l].sort((a,b)=>(b[M.metric]||0)-(a[M.metric]||0)).slice(0,5)
    :[...todos].sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora)).slice(0,5);
  const stats=M?(()=>{
    const v=ok.map(e=>e[M.metric]).filter(x=>x!=null&&x>0);
    const u=x=>M.unit==='min'?fhora(x):fnum(Math.round(x*10)/10)+' '+M.unit;
    const ult=[...l].sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora))[0];
    return `<div class="stat"><span>${esc(M.title)}: eventos</span><b>${ok.length}</b></div>
      <div class="stat"><span>${uniEv(M)} máxima</span><b class="w">${v.length?u(Math.max(...v)):'—'}</b></div>
      <div class="stat"><span>${uniEv(M)} promedio</span><b>${v.length?u(sum(v)/v.length):'—'}</b></div>
      <div class="stat"><span>Último evento</span><b class="sm">${ult?esc(ult.dia+' '+MES3[ult.mes]+' · '+ult.hora):'—'}</b></div>${celdaDesc}${celdaCara}`;
  })():`<div class="stat"><span>Total de eventos</span><b>${todos.length}</b></div>
      <div class="stat"><span>Velocidad máxima</span><b class="w">${maxV} km/h</b></div>
      <div class="stat"><span>Ralentí máximo</span><b class="w">${maxR?fhora(maxR):'—'}</b></div>
      <div class="stat"><span>Ralentí promedio</span><b>${avgR?fhora(avgR):'—'}</b></div>${celdaDesc}${celdaCara}`;
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
/* Barras de la seccion de periodo: una por mes elegido, o una por dia con eventos.
   Concordancia con lo que se esta viendo (2026-11-04): en "Por dia" sin dias concretos elegidos, la
   barra muestra el MES COMPLETO del alcance y, si ese mes es el actual, se corta en hoy; si el alcance
   trae varios meses (o ninguno, "todos") o no hay ano fijado, lo que tiene sentido es el resumen por
   mes, no un dia suelto. */
/* OJO: RS.mes guarda la POSICION dentro de la ventana de meses que manda el generador (DATOS.meses,
   'YYYY-MM' en key), que no es el numero de mes del calendario: si la ventana arranca en diciembre,
   el indice 10 es octubre. Por eso el "hasta hoy" y el numero de dias del mes se sacan de la llave de
   ese hueco, nunca del indice. */
const rsMesCal=i=>{const k=(DATOS.meses&&DATOS.meses[i]?DATOS.meses[i].key:'')||'';
  return {anio:+k.slice(0,4)||0,mes:(+k.slice(5,7)||0)-1};};
function rsBarras(l){
  if(RS.vista==='mes'){const idx=rsNums().length?rsNums():MES3.map((_,i)=>i);
    return {tit:'Eventos por mes',filas:idx.map(i=>[MES3[i]||('Mes '+(+i+1)),l.filter(e=>e.mes===i).length])};}
  const sel=rsNums();
  if(sel.length) return {tit:'Eventos por día',filas:sel.map(d=>[String(d),l.filter(e=>e.dia===d).length])};
  const ahora=new Date(), ms=RS.mes.map(Number).sort((a,b)=>a-b);
  if(ms.length!==1||!RS.anio){const idx=[...new Set(l.map(e=>e.mes))].sort((a,b)=>a-b);
    const f=idx.length?idx:MES3.map((_,i)=>i);
    return {tit:'Eventos por mes',filas:f.map(i=>[MES3[i]||('Mes '+(+i+1)),l.filter(e=>e.mes===i).length])};}
  const mi=ms[0], cal=rsMesCal(mi),
    esMesActual=cal.anio===ahora.getFullYear()&&cal.mes===ahora.getMonth(),
    tope=esMesActual?ahora.getDate():(cal.anio?new Date(cal.anio,cal.mes+1,0).getDate():Math.max(0,...l.map(e=>e.dia)));
  const dias=[];for(let d=1;d<=tope;d++)if(l.some(e=>e.dia===d))dias.push([String(d),l.filter(e=>e.dia===d).length]);
  return {tit:'Eventos por día · '+MES3[mi]+(esMesActual?' hasta hoy':''),filas:dias};
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
/* Los conductores con mas eventos del modulo, sobre los datos ya filtrados por periodo y filtros.
   El orden se saca de TODA la lista; lo que se muestra se recorta a `n` (3 en el reporte) para que el
   correo no salga con tablas interminables. Cada renglon lleva ademas lo que pidio el usuario: numero
   de equipo (el economico con mas eventos de ese conductor), su velocidad maxima y su maximo de la
   metrica del modulo (duracion en Ralentí y RPM, velocidad en los demas).
   eqN = eventos que ese conductor tuvo EN ESE EQUIPO, sobre sus n eventos del modulo; eqMas = cuantos
   equipos MAS uso. La columna de protocolos salio el 2026-11-05 por pedido del usuario: los protocolos
   siguen en la tarjeta del modulo y en el renglon de encabezado. */
function top5Conductores(l,M,n){
  const g=groupCount(l.filter(e=>e.conductor&&e.conductor!=='Sin conductor'),'conductor');
  const t=[...g.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'es')).slice(0,n);
  return t.map(([con,cnt])=>{
    const ev=l.filter(e=>e.conductor===con);
    const tad=[...groupCount(ev,'tad').entries()].sort((a,b)=>b[1]-a[1])[0];
    const vals=ev.map(e=>e[M.metric]).filter(v=>v!=null);
    const eq=[...groupCount(ev.filter(e=>e.num_economico&&e.num_economico!=='—'),'num_economico').entries()]
      .sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'es'));
    const vs=ev.map(e=>e.velocidad_max).filter(v=>v!=null&&v>0);
    return {con,n:cnt,tad:tad?tad[0]:'—',
      max:vals.length?Math.max(...vals):null,
      eq:eq.length?String(eq[0][0]):'—',eqMas:eq.length-1,eqN:eq.length?eq[0][1]:0,
      vel:vs.length?Math.max(...vs):null};
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
/* LA PRIMERA FILA MANDA: si una tabla declara sus columnas en % se le pone table-layout:fixed. Sin eso,
   el cliente que si respeta CSS (el correo web, el Outlook "nuevo", y el pegar el reporte en cualquier
   editor web) mide la tabla por su contenido: una celda con texto largo o un numero ancho estira su
   columna, la tabla pasa del 100% del mensaje y el reporte sale cortado con barra horizontal. Con las
   columnas fijas cada una vale el % declarado, el texto envuelve dentro de su celda y la tabla nunca
   mide mas que el ancho del correo. Outlook de escritorio usa el motor de Word, que no conoce
   table-layout: ahi manda el width="100%" y los % de cada celda, que ya traen desde el ajuste anterior.
   Las filas que no declaran % (el encabezado azul, los titulos de seccion, los cuadritos de leyenda)
   quedan en auto: ahi repartir por contenido es lo que se quiere y fijarlas las partiria por la mitad.
   Una tabla que ya traiga su propio table-layout en el style no se toca (el bloque de cada modulo lo
   declara fixed). */
function aisla(h){
  const anchoFijo=(str,from)=>{const i=str.slice(from).search(/<tr\b/i); if(i<0) return false;
    const s=str.slice(from+i), e=s.indexOf('</tr>');
    return /\swidth="\d+(?:\.\d+)?%"/.test(e<0?s.slice(0,300):s.slice(0,e));};
  return h.replace(/<([a-z]+)([^>]*?)>/gi,(m,tag,at,ofs,full)=>{
    const t=tag.toLowerCase(), adds=[];
    for(const a in AISLA_P){
      const x=new RegExp('\\s'+a+'="([^"]+)"','i').exec(at); if(!x) continue;
      let v=x[1].trim();
      if((a==='width'||a==='height') && /^\d+$/.test(v)) v+='px';
      if(a==='align'&&t==='table') adds.push(v==='center'?'margin:0 auto':v==='right'?'margin-left:auto':'margin-right:auto');
      else adds.push(AISLA_P[a]+':'+v);
    }
    if(t==='table'&&!/table-layout/i.test(at)) adds.push('table-layout:'+(anchoFijo(full,ofs+m.length)?'fixed':'auto'));
    /* box-sizing en la celda: con table-layout:fixed el % declarado se mide en el content-box, así que
       el padding se SUMABA arriba del % y la columna flexible (Conductor, la marca de la barra) quedaba
       mas angosta de lo disenado: un 5% con 20 px de padding salia en 8.3 reales. Con border-box el %
       manda y la letra del correo cae justo donde la dibujo el diseno. Word no conoce box-sizing. */
    if((t==='td'||t==='th')&&!/box-sizing/i.test(at)) adds.push('box-sizing:border-box');
    if(!adds.length) return m;
    const s=/ style="([^"]*)"/i.exec(at);
    return s? m.replace(' style="'+s[1]+'"',' style="'+s[1]+';'+adds.join(';')+'"')
            : m.replace(/>$/,' style="'+adds.join(';')+'">');
  });
}
/* El nombre que sale en el correo: encabezado azul, pie, version de texto y asunto. Se cambia aqui y
   en los cuatro lugares a la vez (2026-11-05, "que se llame reportes alertas traffilo"). */
const NOMBRE_REPORTE='Reportes Alertas Traffilo';
/* La imagen del final del reporte (la carpeta Complementos, o el archivo que diga el .env). El servidor
   la lee y la manda en base64 para que se vea en la vista previa del modal y al copiarla con diseño; en el mensaje de
   Outlook viaja distinta: el HTML lleva src="cid:..." y el servidor adjunta el archivo con ese
   Content-ID, porque el motor de Word no lee data: y ademas el correo pesaria el triple. */
const REP_CID='tad-imagen-reporte';
let IMG_REP={src:'',nombre:'',w:0,h:0,carpeta:'',error:'',intentado:false,otras:[]};
function cargaImagenReporte(al){
  if(IMG_REP.intentado){if(al)al(IMG_REP);return;}
  IMG_REP.intentado=true;
  fetch('/reporte-imagen',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject())
    .then(j=>{
      if(!j.ok){IMG_REP.error=j.error||'no hay imagen de reporte';if(al)al(IMG_REP);return;}
      const url='data:'+j.mime+';base64,'+j.data, im=new Image();
      im.onload=()=>{Object.assign(IMG_REP,{src:url,nombre:j.nombre,carpeta:j.carpeta||'',
        otras:j.otras||[],w:im.naturalWidth||640,h:im.naturalHeight||0,error:''});if(al)al(IMG_REP);};
      im.onerror=()=>{IMG_REP.error='la imagen '+j.nombre+' no se pudo abrir';if(al)al(IMG_REP);};
      im.src=url;
    })
    .catch(()=>{IMG_REP.error='sin servidor local: no se puede leer la carpeta de Complementos';if(al)al(IMG_REP);});
}
/* Solo para lo que se manda a Outlook: la imagen sale del base64 y pasa a la referencia cid. */
function repHtmlCorreo(h){
  return String(h||'').replace(/<img[^>]*data-tad-imagen[^>]*>/gi,m=>m.replace(/src="[^"]*"/,'src="cid:'+REP_CID+'"'));
}
/* La fila del final: centrada, con el tamano real de la imagen (que el panel ya mido al cargarla) para
   que Word no la estire ni la deje chiquita, y con su nombre debajo para que se sepa que archivo es. */
function filaImagenReporte(){
  if(!IMG_REP.src)return'';
  const w=Math.min(640,IMG_REP.w||640), h=IMG_REP.h?Math.round(IMG_REP.h*w/(IMG_REP.w||640)):0;
  return `<tr><td style="padding:6px 20px 16px" align="center">`
    +`<img data-tad-imagen="1" src="${IMG_REP.src}" width="${w}"${h?` height="${h}"`:''}`
    +` style="max-width:100%;height:auto;border:1px solid #dde4ef" alt="${esc(IMG_REP.nombre)}">`
    +`<div style="font-size:10px;color:#5c6b81;padding-top:6px">${esc(IMG_REP.nombre)}</div></td></tr>`;
}

/* La peticion que cierra el reporte, justo antes de la imagen (2026-11-05, texto dictado por el
   usuario). Lleva subrayado desde "realizar" hasta "OAT´s", que es lo que pidio; Word si respeta <u>,
   así que se ve igual aqui, al copiar con diseño y en el correo. Sale aunque no haya imagen: la
   peticion no depende del archivo, es el cierre del reporte. TP no alcanza hasta aqui (vive dentro de
   construirReporte), así que los atributos de presentacion van escritos. */
const FRASE_PROTOCOLO='Por lo anterior se les solicita realizar el PROTOCOLO a los OAT´s involucrados remitiéndonos la evidencia a la Superintendencia de Reparto';
function filaProtocolo(){
  const i=FRASE_PROTOCOLO.indexOf('realizar'), j=FRASE_PROTOCOLO.indexOf('OAT´s')+5;
  return `<tr><td style="padding:16px 20px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">`
    +`<tr><td width="3" bgcolor="#8C2F39" style="font-size:1px;line-height:1px">&nbsp;</td>`
    +`<td bgcolor="#faf5f5" style="padding:11px 14px;font-size:12.5px;color:#22334a">`
    +esc(FRASE_PROTOCOLO.slice(0,i))+`<u>${esc(FRASE_PROTOCOLO.slice(i,j))}</u>`+esc(FRASE_PROTOCOLO.slice(j))
    +`</td></tr></table></td></tr>`;
}

/* La linea del modal que dice que imagen va al final (o por que no va ninguna), para que nadie mande
   el reporte esperando una imagen que en este equipo no esta. */
function imgNota(){
  if(IMG_REP.nombre){
    /* Si la elegida no trae la palabra Protocolo en el nombre, se lista lo que SI hay en esa carpeta:
       con eso se distingue "aqui no existe el archivo" de "el servidor que esta abierto es viejo y todavia
       usa la regla de la primera imagen por nombre". */
    const otras=!/protocolo/i.test(IMG_REP.nombre)&&IMG_REP.otras&&IMG_REP.otras.length
      ? ' En esa carpeta tambien hay: '+esc(IMG_REP.otras.join(', '))+
        (/(^| |\\|\/)protocolo/i.test(IMG_REP.otras.join(' '))
          ? ' · el de Protocolo SI esta, pero este servidor aun no lo conoce: cierre la ventana negra del panel y vuelva a abrir ABRIR_DASHBOARD.bat.'
          : '')
      : '';
    return `Imagen del final: <b>${esc(IMG_REP.nombre)}</b>, desde <b>${esc(IMG_REP.carpeta||'Complementos')}</b>.${otras} Se ve en el correo y va adjunto el archivo.`;
  }
  if(IMG_REP.error) return `El reporte sale <b>sin imagen</b>: ${esc(IMG_REP.error)}.`;
  return 'Buscando la imagen del final del reporte…';
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
  /* Top 3 en las tablas del reporte (2026-11-04): el orden se calcula sobre TODOS los eventos del
     periodo y solo se muestran los tres primeros, para que el correo no tenga que llevar la lista
     completa de conductores debajo de cada grafica. */
  const REP_TOP=3;
  const mods=['alta','ralenti','neutral','rpm','frenado'].map(k=>{
    const M=MODS[k], base=EV.filter(e=>M.types.includes(e.tipo_evento)), lista=cuentan(rsFiltro(base));
    const max=lista.length?lista.reduce((a,b)=>b[M.metric]>a[M.metric]?b:a):null;
    const tad=[...groupCount(lista,'tad').entries()].sort((a,b)=>b[1]-a[1])[0];
    const eq=[...groupCount(lista.filter(e=>e.num_economico&&e.num_economico!=='—'),'num_economico').entries()]
      .sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'es'))[0];
    const vs=lista.map(e=>e.velocidad_max).filter(v=>v!=null&&v>0);
    return {M,lista,n:lista.length,max,tad,eq,
      vel:vs.length?Math.max(...vs):null,prot:lista.filter(archSubido).length,
      cond:new Set(lista.filter(e=>e.conductor&&e.conductor!=='Sin conductor').map(e=>e.conductor)).size,
      top:top5Conductores(lista,M,REP_TOP),
      resto:top5Conductores(lista,M,1e9).slice(REP_TOP)};
  });
  const rp=rsBarras(l), mx=Math.max(1,...rp.filas.map(f=>f[1]));
  /* La tabla "Top 3 · Alta velocidad" del final salio del reporte el 2026-11-05 por pedido del
     usuario ("quita esa tabla"). El resto del alta velocidad sigue: esta en su modulo arriba, con sus
     conductores, y en el panel. */

  const PA=PALETAS.institucional.c, co=i=>PA[i%PA.length];   // los mismos colores que las graficas del panel
  const Z='font-family:Arial,Helvetica,sans-serif;color:#1c2a3f;font-size:12.5px;overflow-wrap:break-word;';   // hereda el envoltorio: Word lo ignora y los correos web lo respetan
  const TP='role="presentation" width="100%" cellpadding="0" cellspacing="0"';   // T ya es el catalogo de tipos de evento
  /* La letra sigue al fondo, medido (2026-11-05: al pegar el reporte en Outlook salia renglon oscuro con
     letra oscura). Los colores de la paleta no todos son oscuros, asi que la tinta no se puede fijar a
     mano: se usa la misma medidora que ya usan las tablas del panel (tbRgb, 11_tablas.js) y, en
     lugar de heredar el color del envoltorio, cada celda escribe el suyo. El motor de Word reescribe los
     colores heredados pero respeta el que va en la propia celda, que es lo que reventaba al pegar. */
  /* Y de las dos tintas claras/oscuros del proyecto se toma la que MAS contraste da, no la que
     sugiere el corte de luminancia: sobre la faixa ambar #C28A2C la letra casi blanca media 2.8:1 y la
     oscura 4.7:1, aunque el ambar pase por fondo oscuro. */
  const lumRep=t=>{const c=tbRgb(t);if(!c)return null;const l=c.map(v=>{const x=v/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4);});
    return .2126*l[0]+.7152*l[1]+.0722*l[2];};
  const razRep=(a,b)=>{const x=lumRep(a),y=lumRep(b);return x==null||y==null?0:(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const TI=f=>tbRgb(f)?(razRep(f,TB_TINTA_CLARA)>=razRep(f,'#1c2a3f')?TB_TINTA_CLARA:'#1c2a3f'):'#1c2a3f';
  /* La linea secundaria va apagada, pero solo si apagada todavía se alcanza a leer (3:1); en los
     colores medios de la paleta eso no se cumple y llevaria letra muerta, asi que ahi repite la tinta
     fuerte y el peso de la letra hace la jerarquia. */
  const TIs=f=>{const a='#d9e3f2',b='#42526b',r1=razRep(f,a),r2=razRep(f,b);
    return Math.max(r1,r2)<3?TI(f):(r1>=r2?a:b);};
  /* ANCHOS EN PORCENTAJE: Outlook renderiza con el motor de Word, que ignora max-width y no encoge
     las columnas dadas en pixeles: con anchos fijos el reporte reventaba el ancho del panel de
     lectura, de la hoja o del documento donde se pega. Las columnas van por lo tanto en % de la tabla
     (el total del disenio sigue midiendo 680 px en la vista previa del panel, así que alli se ve
     exactamente igual que antes) y solo quedan en pixeles los cuadritos de color de las leyendas. */
  /* Outlook renderiza con el motor de Word: ignora margins, border-radius, flex y los divs con altura.
     Por eso las barras son celdas con bgcolor y toda la separacion va en padding de fila/celda. */
  const barra=(p,c,h)=>{const w=Math.max(0,Math.min(100,Math.round(p||0)));
    return `<table ${TP} style="border-collapse:collapse"><tr><td width="${w}%" bgcolor="${c}" style="height:${h||10}px;font-size:1px;line-height:1px">&nbsp;</td><td bgcolor="#e6ecf5" style="height:${h||10}px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>`;};
  const tile=(lbl,val,c,s)=>`<td width="25%" valign="top" bgcolor="#fbfcfe" style="border:1px solid #dde4ef;border-top:3px solid ${c};padding:9px 11px"><div style="font-size:9.5px;color:#5c6b81;text-transform:uppercase;letter-spacing:.5px">${lbl}</div><div style="font-size:20px;font-weight:700;color:${c};padding-top:3px">${val}</div>${s?`<div style="font-size:9.5px;color:#5c6b81;padding-top:2px">${s}</div>`:''}</td>`;
  const th=a=>`bgcolor="#263a5c" style="background:#263a5c;color:${TI('#263a5c')};font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;text-align:${a||'left'};padding:7px 10px"`;
  const td=a=>`style="font-size:12px;color:${TI('#ffffff')};padding:8px 10px;border-bottom:1px solid #e9edf4;text-align:${a||'left'};vertical-align:middle"`;
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
      const cel=z=>z?`<td width="9%" align="right" style="font-size:10.5px;color:#42526b;padding:3px 6px 3px 0">${esc(z[0])}</td><td>${barra(z[1]/mx*100,c,8)}</td><td width="7%" style="font-size:10.5px;padding:3px 0 3px 6px"><b>${fmtN(z[1])}</b></td>`
                   :`<td width="9%"></td><td></td><td width="7%"></td>`;
      return `<tr>${cel(x)}${cel(y)}</tr>`;}).join('')+`</table>`;};
  const dist=(rp2,c)=>{const mx2=Math.max(1,...rp2.filas.map(f=>f[1]));
    return rp2.filas.length<=14?columnas(rp2.filas,c):barras2(rp2.filas,mx2,c);};
  const tot=mods.reduce((a,m)=>a+m.n,0)||1;
  /* "Composición del reporte" ya no trae la barra apilada (la linea de grafica): el 2026-11-05 el
     usuario pidio dejar solo los eventos con su porcentaje, que es lo que muestra la leyenda. */
  const leyenda=`<table ${TP} style="border-collapse:collapse">`+[0,3].map(k=>`<tr>`+mods.slice(k,k+3).map((m,i)=>`<td width="33%" style="padding:6px 10px 0 0"><table cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td width="10" bgcolor="${co(k+i)}" style="height:9px;font-size:1px;line-height:1px">&nbsp;</td><td style="padding-left:6px;font-size:11px;color:#42526b">${esc(m.M.title)} <b>${fmtN(m.n)}</b> · ${Math.round(m.n/tot*100)}%</td></tr></table></td>`).join('')+`</tr>`).join('')+`</table>`;
  /* Resumen por modulo — CASO 6 (2026-11-05): la tabla de renglones se cambi6 por TARJETAS DE COLOR,
     una por modulo, que es el disenio que el usuario eligi6 ("impactante"). Como Outlook usa el motor de
     Word, la tarjeta no puede ser un div con sombra ni esquinas redondas (los ignora): es una tabla con
     su faixa de color arriba, el numero grande en el centro y sus datos en renglones etiqueta/valor.
     Van tres tarjetas por fila y la celda que sobra queda vacia, para que la ultima fila no se estire.
     Los datos son los mismos de la tabla anterior: eventos, maximo, numero de equipo, velocidad y
     protocolos subidos, mas los conductores del modulo. */
  const kl=tt=>`<td style="font-size:9.5px;color:#5c6b81;text-transform:uppercase;letter-spacing:.4px;padding:5px 0">${tt}</td>`;
  const kv=x=>`<td align="right" style="font-size:11.5px;padding:5px 0">${x}</td>`;
  const par=(t,x)=>`<tr>${kl(t)}${kv(x)}</tr>`;
  const tarjetaMod=(m,i)=>{
    const c=m.n?co(i):'#8fa0b8';
    return `<td width="33%" valign="top" style="padding:0 8px 12px 0"><table ${TP} style="border-collapse:collapse;width:100%;border:1px solid #dde4ef">
      <tr><td bgcolor="${c}" style="padding:7px 10px;font-size:10.5px;font-weight:700;color:${TI(c)};text-transform:uppercase;letter-spacing:.5px">${esc(m.M.title)}</td></tr>
      <tr><td bgcolor="#f4f7fb" align="center" style="padding:11px 8px 9px"><div style="font-size:28px;font-weight:700;line-height:1;color:${c}">${fmtN(m.n)}</div><div style="font-size:9.5px;color:#5c6b81;text-transform:uppercase;letter-spacing:.5px;padding-top:5px">evento${m.n===1?'':'s'} · ${Math.round(m.n/tot*100)}% del reporte</div></td></tr>
      <tr><td style="padding:0 10px">${barra(m.n/tot*100,c,4)}</td></tr>
      ${m.n?`<tr><td style="padding:8px 10px 10px"><table ${TP} style="border-collapse:collapse;width:100%">
        ${par('Máximo',`<b>${fval(m.M,m.max[m.M.metric])}</b><span style="color:#5c6b81"> · ${esc(m.max.conductor)}</span>`)}
        ${par('No. equipo',m.eq?`<b>${esc(String(m.eq[0]))}</b><span style="color:#5c6b81"> · ${fmtN(m.eq[1])} evt.</span>`:'<span style="color:#a9b8cd">—</span>')}
        ${par('Velocidad',m.vel!=null?`<b style="color:#8C2F39">${fmtN(m.vel)} <span style="font-size:9.5px">km/h</span></b>`:'<span style="color:#a9b8cd">—</span>')}
        ${par('Protocolos',`<b>${fmtN(m.prot)}</b><span style="color:#5c6b81"> de ${fmtN(m.n)}</span>`)}
        ${par('Conductores',`<b>${fmtN(m.cond)}</b>`)}</table></td></tr>`
        :`<tr><td align="center" style="padding:11px 10px;font-size:11px;color:#5c6b81">Sin eventos para los filtros seleccionados</td></tr>`}
    </table></td>`;
  };
  const tarjetas=mods.map((m,i)=>tarjetaMod(m,i));
  const tarjetasMod=`<table ${TP} style="border-collapse:collapse">`+[0,3].map(s=>`<tr>${tarjetas.slice(s,s+3).join('')}${'<td width="33%"></td>'.repeat(Math.max(0,3-Math.min(3,tarjetas.length-s)))}</tr>`).join('')+`</table>`;
  /* Detalle por conductor (2026-11-04, con la captura del boletin que mando el usuario): debajo de la
     fila de cada uno de los 3 primeros se ponen las dos cosas que el boletin muestra para ese conductor:
     su reparto y sus ultimos eventos con el valor. Lo mismo que en pantalla, pero en HTML de correo: dos
     tablas hijas lado a lado, barras hechas con celdas bgcolor y anchos en %.
     El reparto sale de rsBarras(), la misma funcion de la grafica del modulo de abajo, para que cada
     conductor se reparta por mes o por dia segun como este armado el periodo (concordancia).
     REP_ULT y REP_MARCAS son los unicos numeros que hay que mover si se quiere la ficha completa del
     boletin (5 eventos y todas las marcas del periodo) a costa de alargar el correo. */
  const REP_ULT=3, REP_MARCAS=6;
  const valEv=(e,M)=>M.unit==='min'?(e.duracion_min!=null?fhora(e.duracion_min):'—'):(e.velocidad_max?e.velocidad_max+' km/h':'—');
  const lblEv=e=>`${e.dia} ${MES3[e.mes]||('Mes '+(+e.mes+1))} ${e.fecha.slice(0,4)} · ${e.hora}`;
  const evDeCon=(l,con)=>l.filter(e=>e.conductor===con);
  const ultEv=l=>[...l].sort((a,b)=>(b.fecha+b.hora).localeCompare(a.fecha+a.hora)).slice(0,REP_ULT);
  const cab=(t,w)=>`<td${w?` width="${w}"`:''} style="font-size:9px;color:#5c6b81;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e9edf4;padding:0 0 3px">${t}</td>`;
  /* Reparto de un conductor: la misma marca que usa la grafica de su modulo (mes o dia segun el periodo).
     Si el periodo deja una sola marca, la barrita no cuenta nada, asi que se baja a los dias de ese mes
     —igual que cuando se toca el mes en la grafica del panel. */
  const marcasConductor=l=>{const m=rsBarras(l);
    if(m.filas.length>1) return m;
    const ms=[...new Set(l.map(e=>+e.mes))];
    if(ms.length!==1) return m;
    const mi=ms[0];
    return {tit:'Eventos por día · '+(MES3[mi]||('Mes '+(+mi+1))),
      filas:[...new Set(l.map(e=>e.dia))].sort((a,b)=>a-b).map(d=>[String(d),l.filter(e=>e.dia===d).length])};};
  const detalleConductor=(l,M,c,nc)=>{
    if(!l.length) return '';
    const ult=ultEv(l), mp=marcasConductor(l), marcas=mp.filas.slice(-REP_MARCAS),
      corta=mp.filas.length>marcas.length, mxM=Math.max(1,...marcas.map(f=>f[1]));
    /* Los anchos van tambien en el renglon de encabezado: Word toma las columnas por las primeras
       celdas que ve y si solo estan en los datos, la tabla hija se desalinea al pegar el correo. */
    const listaEv=`<table ${TP} style="border-collapse:collapse"><tr>${cab(`Últimos ${ult.length} evento${ult.length===1?'':'s'} de ${fmtN(l.length)}`,'74%')}<td width="26%" align="right" style="font-size:9px;color:#5c6b81;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e9edf4;padding:0 0 3px">valor</td></tr>`+
      ult.map(e=>`<tr><td style="padding:4px 6px 0 0;font-size:11px;border-bottom:1px solid #f0f3f8">${esc(e.tipo_evento)}<span style="color:#5c6b81"> · ${esc(lblEv(e))}</span></td><td width="26%" align="right" valign="top" style="padding:4px 0 0;font-size:11px;border-bottom:1px solid #f0f3f8"><b>${esc(valEv(e,M))}</b></td></tr>`).join('')+`</table>`;
    const barras=`<table ${TP} style="border-collapse:collapse"><tr>${cab(mp.tit.split(' · ')[0],'30%')}<td style="font-size:9px;color:#5c6b81;border-bottom:1px solid #e9edf4;padding:0 0 3px" align="${corta?'right':'left'}">${corta?`los ${marcas.length} más recientes de ${mp.filas.length}`:''}</td><td width="16%"></td></tr>`+
      marcas.map(([lbl,v])=>`<tr><td width="30%" style="padding:3px 6px 0 0;font-size:10.5px;color:#42526b">${esc(lbl)}</td><td valign="middle">${barra(v/mxM*100,c,7)}</td><td width="16%" align="right" valign="top" style="padding:3px 0 0;font-size:10.5px"><b>${fmtN(v)}</b></td></tr>`).join('')+`</table>`;
    return `<tr><td colspan="${nc}" bgcolor="#fbfcfe" style="color:${TI('#fbfcfe')};padding:9px 12px 10px;border-bottom:1px solid #e9edf4"><table ${TP} style="border-collapse:collapse"><tr><td width="62%" valign="top" style="padding-right:14px">${listaEv}</td><td valign="top">${barras}</td></tr></table></td></tr>`;
  };
  /* Bloque por modulo (2026-11-04): sale la columna "Frecuencia" —la barrita ahora va debajo del
     numero de eventos, el diseno se conserva sin gastar columna— y entran No. de equipo y velocidad.
     Se listan los 3 primeros, pero el orden se calculo sobre TODOS los eventos del
     periodo; la linea de abajo dice de cuantos conductores salen, para que no parezca que solo hay 3.
     CASO 4 (2026-11-05): debajo de los 3 con ficha van TAMBIEN los demas conductores del modulo, en
     renglon sencillo: sin la casilla de color del numero, sin negritas y sin su bloque de detalle.
     CORTE 2026-11-05 (pedido del usuario con la captura de la columna No. equipo): sale la columna de
     PROTOCOLOS —los protocolos siguen visibles en la tarjeta del modulo y en el renglon de encabezado,
     que es donde se leian como total del modulo— y entra DURACION en los modulos que miden tiempo
     (Ralentí y RPM). Por eso la tabla ya no siempre tiene seis columnas: NC es las que tiene cada una
     y colspan lo sigue, para que la ficha del conductor y las filas de "resto" no desalineen Word. */
  const bloqueMod=(m,i)=>{
    if(!m.n) return '';
    const durM=m.M.metric==='duracion_min', NC=durM?6:5;
    const rp2=rsBarras(m.lista);
    const filasTop=m.top.length?m.top.map((r,j)=>`<tr${j%2?' bgcolor="#f7f9fc"':''}>
      <td width="5%" align="center" bgcolor="${co(i)}" style="font-size:11px;font-weight:700;color:${TI(co(i))};padding:8px 0;border-bottom:1px solid #e9edf4">${j+1}</td>
      <td ${td()}><b>${esc(r.con)}</b><div style="font-size:10px;color:#5c6b81;padding-top:2px">${esc(r.tad)}${r.max!=null?' · máx '+fval(m.M,r.max):''}</div></td>
      <td width="12%" ${td('right')}>${r.eq!=='—'?`<b>${esc(r.eq)}</b><div style="font-size:10px;color:#5c6b81">${fmtN(r.eqN)} de ${fmtN(r.n)} eventos en este equipo${r.eqMas?' · usó '+fmtN(r.eqMas+1)+' equipos':''}</div>`:'<span style="color:#8fa0b8">—</span>'}</td>
      <td width="11%" ${td('right')}>${r.vel!=null?`<b style="color:#8C2F39">${fmtN(r.vel)}</b><div style="font-size:10px;color:#5c6b81">km/h</div>`:'<span style="color:#8fa0b8">—</span>'}</td>
      ${durM?`<td width="11%" ${td('right')}>${r.max!=null?`<b>${esc(fhora(r.max))}</b><div style="font-size:10px;color:#5c6b81">máxima</div>`:'<span style="color:#8fa0b8">—</span>'}</td>`:''}
      <td width="11%" ${td('right')}><b>${fmtN(r.n)}</b><div style="font-size:10px;color:#5c6b81">${Math.round(r.n/m.n*100)}% del módulo</div>${barra(r.n/m.top[0].n*100,co(i),4)}</td></tr>`
      +detalleConductor(evDeCon(m.lista,r.con),m.M,co(i),NC)).join('')
      :`<tr><td ${td()} colspan="${NC}" style="font-size:12px;color:#5c6b81;padding:8px 10px">Sin conductores asignados en este módulo.</td></tr>`;
    /* Los demas: la misma fila de columnas que arriba para que la tabla cuadre, pero con la tinta
       apagada y sin la casilla de color. El numero de la primera columna sigue la cuenta real (4, 5, 6...). */
    const filasResto=m.resto.length?`<tr><td colspan="${NC}" style="padding:9px 10px 5px;font-size:9px;color:#5c6b81;text-transform:uppercase;letter-spacing:.6px;border-top:1px solid ${co(i)}">Resto de conductores del módulo</td></tr>`
      +m.resto.map((r,j)=>`<tr${(REP_TOP+j)%2?' bgcolor="#fbfcfe"':''}>
      <td width="5%" align="center" style="font-size:11px;color:#8fa0b8;padding:7px 0;border-bottom:1px solid #f0f3f8">${REP_TOP+j+1}</td>
      <td style="font-size:12px;color:${TI('#fbfcfe')};padding:7px 10px;border-bottom:1px solid #f0f3f8;vertical-align:middle">${esc(r.con)}<div style="font-size:10px;color:#8fa0b8;padding-top:2px">${esc(r.tad)}${r.max!=null?' · máx '+fval(m.M,r.max):''}</div></td>
      <td width="12%" style="font-size:12px;padding:7px 10px;border-bottom:1px solid #f0f3f8;text-align:right;vertical-align:middle;color:#42526b">${r.eq!=='—'?esc(r.eq):'<span style="color:#a9b8cd">—</span>'}${r.eq!=='—'?`<div style="font-size:10px;color:#8fa0b8">${fmtN(r.eqN)} de ${fmtN(r.n)} eventos en este equipo${r.eqMas?' · usó '+fmtN(r.eqMas+1)+' equipos':''}</div>`:''}</td>
      <td width="11%" style="font-size:12px;padding:7px 10px;border-bottom:1px solid #f0f3f8;text-align:right;vertical-align:middle;color:#42526b">${r.vel!=null?fmtN(r.vel)+' <span style="font-size:10px;color:#8fa0b8">km/h</span>':'<span style="color:#a9b8cd">—</span>'}</td>
      ${durM?`<td width="11%" style="font-size:12px;padding:7px 10px;border-bottom:1px solid #f0f3f8;text-align:right;vertical-align:middle;color:#42526b">${r.max!=null?esc(fhora(r.max))+' <span style="font-size:10px;color:#8fa0b8">máxima</span>':'<span style="color:#a9b8cd">—</span>'}</td>`:''}
      <td width="11%" style="font-size:12px;padding:7px 10px;border-bottom:1px solid #f0f3f8;text-align:right;vertical-align:middle;color:#42526b">${fmtN(r.n)}<div style="font-size:10px;color:#8fa0b8">${Math.round(r.n/m.n*100)}% del módulo</div></td></tr>`).join(''):'';
    return `<table ${TP} style="border-collapse:collapse;table-layout:fixed;border:1px solid #dde4ef">
      <tr><td bgcolor="${co(i)}" style="color:${TI(co(i))};padding:9px 12px"><table ${TP} style="border-collapse:collapse"><tr>
        <td style="font-size:13px;font-weight:700;color:${TI(co(i))}"><span style="color:${TI(co(i))}">${esc(m.M.title)}</span></td>
        <td align="right" valign="middle" style="font-size:10.5px;color:${TIs(co(i))}"><span style="color:${TIs(co(i))}">${fmtN(m.n)} eventos · ${Math.round(m.n/tot*100)}% del reporte · máx ${fval(m.M,m.max[m.M.metric])} · ${fmtN(m.prot)} protocolo${m.prot===1?'':'s'}${m.tad?' · líder '+esc(m.tad[0]):''}</span></td></tr></table></td></tr>
      <tr><td style="padding:10px 12px 2px"><table ${TP} style="border-collapse:collapse">
        <tr><td width="5%" ${th('center')}>#</td><td ${th()}>Conductor</td><td width="12%" ${th('right')}>No. equipo</td><td width="11%" ${th('right')}>Velocidad</td>${durM?`<td width="11%" ${th('right')}>Duración</td>`:''}<td width="11%" ${th('right')}>Eventos</td></tr>
        ${filasTop}${filasResto}</table></td></tr>
      ${m.top.length&&m.cond>m.top.length?`<tr><td style="padding:5px 12px 0;font-size:10px;color:#5c6b81">Los ${m.top.length} primeros con su ficha completa y, debajo, los ${fmtN(m.cond-m.top.length)} conductor${m.cond-m.top.length===1?'':'es'} restantes del módulo (${fmtN(m.cond)} en total).</td></tr>`:''}
      <tr><td style="padding:12px"><table ${TP} style="border-collapse:collapse"><tr><td style="font-size:9.5px;color:#5c6b81;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e9edf4;padding-bottom:4px">${esc(rp2.tit)}</td><td align="right" style="font-size:9.5px;color:#5c6b81;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e9edf4;padding-bottom:4px">total ${fmtN(m.n)}</td></tr></table>${dist(rp2,co(i))}</td></tr>
    </table>`;
  };
  const bloques=mods.map(bloqueMod).join(`<table ${TP} style="border-collapse:collapse"><tr><td style="height:14px;font-size:1px">&nbsp;</td></tr></table>`);
  /* Historico mes x modulo (2026-11-04): se arma con TODOS los eventos del ano elegido (o de toda la
     base si no se fijo ano) y con los demas filtros, pero SIN recortar por meses ni dias. Es el
     apartado que permite no mostrar todo junto: arriba va el periodo seleccionadisimo y aqui se ve la
     tendencia completa. Con el ano suelto, cada fila es un mes del ano; sin ano, la etiqueta lleva
     el ano porque "Enero" existiria en 2025 y 2026 a la vez. */
  const hBase=cuentan(rsAnio(EV));
  const hKey=e=>RS.anio?+e.mes:(+e.anio||0)*100+ +e.mes;
  const hLbl=k=>RS.anio?(MES3[k]||('Mes '+(+k+1))):(MES3[k%100]||('Mes '+(+k%100+1)))+' '+Math.floor(k/100);
  const hMes=[...new Set(hBase.map(hKey))].sort((a,b)=>a-b);
  const hMod=mods.map(m=>{const q=hBase.filter(e=>m.M.types.includes(e.tipo_evento));
    return {M:m.M,vals:hMes.map(k=>q.filter(e=>hKey(e)===k).length),tot:q.length};});
  const hTot=hMes.map((k,i)=>hMod.reduce((a,m)=>a+m.vals[i],0));
  const hMx=Math.max(1,...hTot);
  const hFin=hMod.reduce((a,m)=>a+m.tot,0);
  const filasHist=hMes.length?hMes.map((k,i)=>fila(`<td width="14%" ${td()}><b>${esc(hLbl(k))}</b></td>`+
      hMod.map(m=>`<td width="14%" ${td('right')}>${m.vals[i]?fmtN(m.vals[i]):'<span style="color:#9fb0c6">·</span>'}</td>`).join('')+
      `<td width="16%" ${td('right')}><b>${fmtN(hTot[i])}</b>${barra(hTot[i]/hMx*100,'#263a5c',4)}</td>`,i)).join('')
      +fila(`<td width="14%" ${td()} bgcolor="#f4f7fb"><b>Total ${esc(RS.anio?String(RS.anio):'histórico')}</b></td>`+
        hMod.map(m=>`<td width="14%" ${td('right')} bgcolor="#f4f7fb"><b>${fmtN(m.tot)}</b><div style="font-size:10px;color:#5c6b81">${hTot.length?Math.round(m.tot/hFin*100):0}%</div></td>`).join('')+
        `<td width="16%" ${td('right')} bgcolor="#f4f7fb"><b>${fmtN(hFin)}</b></td>`,hMes.length)
    :`<tr><td ${td()} colspan="7" style="font-size:12px;color:#5c6b81;padding:8px 10px">Sin eventos en la base para el año y filtros seleccionados.</td></tr>`;
  /* SIN max-width: Word lo ignora y los clientes de correo web si lo respetan, así que con el tope de
     680 px el correo salia chiquito en una ventana ancha y con barra horizontal en el panel de lectura
     angosto. El ancho de la vista previa del panel lo da la caja (.rep-lienzo mide 680 px), no este
     tope: aqui se quita y el reporte llena el ancho del mensaje, que es lo que se veia mal al pegar. */
  const html=`<table id="repBody" ${TP} style="${Z}table-layout:fixed;border-collapse:collapse;width:100%;border:1px solid #dde4ef;background:#ffffff">
<tr><td bgcolor="#263a5c" style="color:${TI('#263a5c')};padding:16px 20px"><table ${TP} style="border-collapse:collapse"><tr>
  <td style="font-size:17px;font-weight:700;color:${TI('#263a5c')}"><span style="color:${TI('#263a5c')}">${NOMBRE_REPORTE}</span></td>
  <td align="right" valign="bottom" style="font-size:10px;color:${TIs('#263a5c')};text-transform:uppercase;letter-spacing:.6px"><span style="color:${TIs('#263a5c')}">PEMEX · OnCommand</span></td></tr>
<tr><td colspan="2" style="font-size:11.5px;color:${TIs('#263a5c')};padding-top:7px"><b style="color:${TI('#263a5c')}">Elaborado:</b> ${esc(hoy)}</td></tr>
<tr><td colspan="2" style="font-size:11.5px;color:${TIs('#263a5c')};padding-top:3px"><b style="color:${TI('#263a5c')}">Fechas seleccionadas:</b> ${esc(periodo)}</td></tr>
<tr><td colspan="2" style="font-size:11px;color:${TIs('#263a5c')};padding-top:3px">Filtros: ${esc(filtros)}</td></tr></table></td></tr>
<tr><td style="padding:0"><table ${TP} style="border-collapse:collapse"><tr>${[0,1,2,3,4].map(k=>`<td width="20%" bgcolor="${co(k)}" style="height:4px;font-size:1px;line-height:1px">&nbsp;</td>`).join('')}</tr></table></td></tr>
${cuerpo(`<table ${TP} style="border-collapse:collapse;margin:0"><tr>${tiles.join('')}</tr></table>`)}
${sec('Composición del reporte',`${fmtN(tot)} eventos en los 5 módulos`)}
${cuerpo(leyenda)}
${sec('Resumen por módulo','una tarjeta por módulo · máximo, equipo líder, velocidad y protocolos del periodo')}
${cuerpo(tarjetasMod)}
${sec(rp.tit,`escala: ${fmtN(mx)} eventos`)}
${cuerpo(dist(rp,mx))}
${sec('Histórico · eventos por mes y módulo',`${RS.anio?esc(String(RS.anio)):'toda la base'} · ${hMes.length} mes${hMes.length===1?'':'es'} · ${fmtN(hFin)} evento${hFin===1?'':'s'}`)}
${cuerpo(`<table ${TP} style="border-collapse:collapse"><tr><td width="14%" ${th()}>Mes</td>${hMod.map(m=>`<td width="14%" ${th('right')}>${esc(m.M.title)}</td>`).join('')}<td width="16%" ${th('right')}>Total</td></tr>${filasHist}</table>`)}
${sec(`Por módulo · todos los conductores`,`los ${REP_TOP} primeros con su ficha (últimos ${REP_ULT} eventos y reparto) y debajo, en renglón sencillo, los demás conductores con eventos del módulo`)}
${cuerpo(bloques||`<table ${TP} style="border-collapse:collapse"><tr><td style="font-size:12px;color:#5c6b81">Sin eventos para el periodo y filtros seleccionados.</td></tr></table>`)}
${filaProtocolo()}
${filaImagenReporte()}
<tr><td bgcolor="#f4f7fb" style="padding:11px 20px;border-top:1px solid #dde4ef;font-size:10.5px;color:#5c6b81">${NOMBRE_REPORTE} · ${fmtN(EV.length)} eventos en la base · periodo del reporte ${fmtN(l.length)} · ${esc(hoy)}</td></tr>
</table>`;

  /* Version de texto (se copia al portapapeles y es lo que se pega en el cuerpo del correo si la
     persona no quiere el HTML). Mismas cifras que las tarjetas: con equipo, velocidad y, en los modulos
     que miden tiempo, la duracion maxima; los 3 primeros conductores con su detalle y, en una linea
     aparte, el resto de los conductores del modulo (caso 4, 2026-11-05), que en el HTML salen en renglon
     sencillo. Sale el conteo de protocolos por conductor (corte 2026-11-05) para que texto y tabla
     digan lo mismo; los protocolos siguen en el renglon del modulo. */
  const conTexto=m=>t=>`${t.con} (${fmtN(t.n)} eventos, equipo ${t.eq}`
    +(t.eq!=='—'?` —${fmtN(t.eqN)} de ${fmtN(t.n)} en este equipo${t.eqMas?', usó '+fmtN(t.eqMas+1)+' equipos':''}—`:'')
    +`, ${t.vel!=null?fmtN(t.vel)+' km/h':'sin velocidad'}`
    +(m.M.metric==='duracion_min'?', duración máx '+fval(m.M,t.max):'')+')';
  const detalleTexto=(l,M)=>{
    const ult=ultEv(l), mp=marcasConductor(l), marcas=mp.filas.slice(-REP_MARCAS);
    return `         · ${mp.tit}: ${marcas.map(f=>`${f[0]} ${fmtN(f[1])}`).join(' · ')}`+
      (mp.filas.length>marcas.length?` (los ${marcas.length} más recientes de ${mp.filas.length})`:'')+
      `\n         · últimos: ${ult.map(e=>`${lblEv(e)} · ${e.tipo_evento} · ${valEv(e,M)}`).join(' | ')}`;
  };
  const lineas=mods.flatMap(m=>m.n
    ?[`${m.M.title.toUpperCase()}: ${fmtN(m.n)} eventos | Máx ${fval(m.M,m.max[m.M.metric])} (${m.max.conductor}, ${m.max.tad}) | Equipo líder ${m.eq?`${m.eq[0]} (${fmtN(m.eq[1])})`:'—'} | Vel. máx ${m.vel!=null?fmtN(m.vel)+' km/h':'—'} | Protocolos ${fmtN(m.prot)} de ${fmtN(m.n)}`,
      m.top.length?`   Top ${REP_TOP} conductores: ${m.top.map(conTexto(m)).join(' · ')}`:null,
      m.resto.length?`   Resto de conductores: ${m.resto.map(conTexto(m)).join(' · ')}`:null,
      ...m.top.map(t=>detalleTexto(evDeCon(m.lista,t.con),m.M))].filter(Boolean)
    :[`${m.M.title.toUpperCase()}: sin eventos`]);
  const hist=hMes.length?`HISTÓRICO (${RS.anio?RS.anio:'toda la base'}): ${hMes.map((k,i)=>`${hLbl(k)} ${fmtN(hTot[i])}`).join(' · ')}`
                        :'HISTÓRICO: sin eventos en la base';
  const texto=[`REPORTE · ${NOMBRE_REPORTE.toUpperCase()}`,`${periodo} · ${hoy}`,`Filtros: ${filtros}`,'',
    `GENERAL: ${fmtN(l.length)} eventos`+(conEstatus&&excl?` (sin contar ${fmtN(nDesc)} descartada${nDesc===1?'':'s'})`:''),'',hist,'',
    ...lineas,'',FRASE_PROTOCOLO].join('\n');
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
      /* Tambien llega aqui la copia abierta con doble clic (file://): /adjuntos relativo no resuelve. */
      b.innerHTML='<span class="adj-x">Sin servidor local: no se puede leer la carpeta de Entrada ni adjuntar los Excel al correo. De doble clic a <b>ABRIR_DASHBOARD.bat</b> (en la raiz de la USB), <b>deje abierta la ventana negra</b> que sale porque esa ventana ES el servidor, y recargue esta pagina con <b>F5</b>.</span>';});
}

/* ---- Con quien sale el reporte: las dos listas viajan solas ----
   El servidor lee Backend\destinatarios.json (lo que se guarda desde aqui mismo) y si no hay,
   CORREO_PARA y CORREO_CC del .env. La copia en el navegador es para que el panel abierto sin
   servidor, o el primer segundo antes de que conteste el servidor, ya traiga la lista puesta. */
const MAIL_CLAVE='pemex_mail_v1';
/* Lista de destinatarios limpia: quita los espacios que rodean al separador y admite coma o punto y
   coma, pero respeta los espacios DE ADENTRO, porque un grupo de Outlook se escribe tal cual
   ("GLRN_SUPERINTENDENTES 2025") y pegado sin espacio ya no lo encuentra. */
function mailLista(s){return String(s||'').split(/[;,]/).map(x=>x.trim()).filter(Boolean).join(';');}
let MAIL_DEF=(function(){
  try{const g=JSON.parse(localStorage.getItem(MAIL_CLAVE)||'null');
    if(g)return{para:String(g.para||''),cc:String(g.cc||'')};}catch(e){}
  return {para:'',cc:''};
})();
function mailLocal(){try{localStorage.setItem(MAIL_CLAVE,JSON.stringify(MAIL_DEF));}catch(e){}}
function cargaMailDef(){
  const to=$('#mailTo'), cc=$('#mailCC'); if(!to) return;
  const semillaTo=to.value, semillaCc=cc?cc.value:'';      // lo que habia al abrir: si ya escribio, no se le pisa
  fetch('/destinatarios',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject())
    .then(j=>{
      MAIL_DEF={para:String(j.para||''),cc:String(j.cc||'')};mailLocal();
      if(to.value===semillaTo&&!to.value)to.value=MAIL_DEF.para;
      if(cc&&cc.value===semillaCc&&!cc.value)cc.value=MAIL_DEF.cc;
    }).catch(()=>{});                                        // sin servidor: queda lo recordado en el navegador
}

function openMail(){
  rsPodar();
  const R=construirReporte();
  REP_ZOOM=null;                                              // cada vez que se abre el modal, la vista vuelve a adaptarse sola
  $('#modal').classList.remove('ancha');
  $('#modal').innerHTML=`<div class="mh"><h3>Enviar reporte por correo</h3><button class="btn sm" data-act="closeAll" aria-label="Cerrar">${ico('x',16)}</button></div>
  <div class="mb">
    <div class="mail-fila">
      <div class="mail-campo">
        <label style="font-size:12px;color:var(--muted)">Destinatarios</label>
        <input type="text" id="mailTo" value="${esc(MAIL_DEF.para)}" placeholder="grupo@empresa.com; correo2@empresa.com" aria-label="Destinatarios">
      </div>
      <div class="mail-campo">
        <label style="font-size:12px;color:var(--muted)">Copia (CC)</label>
        <input type="text" id="mailCC" value="${esc(MAIL_DEF.cc)}" placeholder="Los que se enteran, separados por ;" aria-label="Copia">
      </div>
    </div>
    <button class="btn sm" type="button" data-act="maildef">${ico('tag',13)} Guardar como predeterminado</button>
    <span class="mail-nota">Outlook abre el mensaje ya con estas dos listas y los Excel pegados.</span>
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
    <label class="adj-box"><input type="checkbox" id="mailAdj" checked> Adjuntar el Excel del periodo (carpeta de Entrada). La imagen del final del reporte se adjunta siempre.</label>
    <div id="rsAdj" class="adj-lista"></div>
    <div id="rsImg" class="adj-lista">${imgNota()}</div>
    <div id="mailAviso" class="mail-aviso"></div>
    <p class="hint" style="margin:12px 0 0">Elige el periodo arriba: en <b>Por mes</b> se marcan los meses; en <b>Por día</b> la fila de meses decide el alcance y la fila de días solo muestra los días con eventos de esos meses. Cada módulo trae su tarjeta de resumen, sus barras del periodo y a <b>todos</b> sus conductores: los 3 primeros con ficha y el resto en renglón sencillo. <b>Outlook</b> abre el mensaje con este diseño, los Excel de esos meses y la imagen del final ya adjuntados. Para pegarlo a mano: <b>Copiar con diseño</b> y Ctrl+V en el correo que abras.</p>
  </div>
  <div class="mf" style="flex-wrap:wrap"><button class="btn" data-act="closeAll">Cancelar</button><button class="btn" data-act="copyrep">${ico('copy',16)} Copiar con diseño</button><button class="btn green" data-act="sendmail" data-via="outlook">Outlook</button></div>`;
  lastFocus=document.activeElement;
  $('#modal').classList.add('on');$('#overlay').classList.add('on');
  $('#mailTo').focus();
  repObserva();
  pintaAdjuntos();
  cargaMailDef();
  /* La imagen llega del servidor y tarda un poco mas que el resto: cuando esta, se repinta solo el
     lienzo para que aparezca abajo, sin mover los destinatarios ni el periodo ya elegido. */
  cargaImagenReporte(()=>{
    const n=$('#rsImg'); if(n) n.innerHTML=imgNota();
    const c=$('#repLienzo'); if(!c||!IMG_REP.src) return;
    c.innerHTML=construirReporte().html; repAjusta();
  });
}
