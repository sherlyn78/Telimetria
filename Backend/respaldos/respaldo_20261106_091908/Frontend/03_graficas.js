/* 03_graficas: ESTUDIO DE GRÁFICAS (Chart.js) con ajustes de diseño al estilo Excel.
   Cada gráfica trae su cinta de opciones: Tipo de gráfico, Estilos, Colores, Elementos, Datos, Exportar.
   Las opciones elegidas se recuerdan en este navegador (localStorage) para la próxima vez. */

/* ---------- Paletas ("Cambiar colores") ---------- */
const PALETAS={
  institucional:{n:'Institucional',c:['#2F4B7C','#B3392F','#C28A2C','#6B7A8F','#4F86C6','#8C2F39','#7FA6D4','#3E6E5A']},
  office:{n:'Office (Excel)',c:['#4472C4','#ED7D31','#A5A5A5','#FFC000','#5B9BD5','#70AD47','#264478','#9E480E']},
  azules:{n:'Azules',c:['#1F3A66','#2F5D9E','#4F86C6','#7FA6D4','#B0C8E6','#0F2540','#3F6FB0','#9DB8DC']},
  verdes:{n:'Verdes',c:['#1E6B4F','#2E9170','#5DB58F','#9AD3B6','#14503B','#CFEAD9','#3FA37F','#0E3B2B']},
  calidos:{n:'Cálidos',c:['#8C2F39','#C0392B','#E07B39','#E8B04A','#F2D28B','#5C1F27','#D4562F','#A8742A']},
  contraste:{n:'Alto contraste',c:['#1F77B4','#D62728','#2CA02C','#FF7F0E','#9467BD','#8C564B','#17BECF','#7F7F7F']},
  grises:{n:'Escala de grises',c:['#1F2933','#4B5563','#6B7280','#9CA3AF','#D1D5DB','#374151','#818B98','#E5E7EB']}
};
const COLOR_ESTATUS={'Descartada':'#6B7A8F','Sin estatus':'#C28A2C'};

/* ---------- Estilos ("Estilos de diseño") ---------- */
const ESTILOS={
  moderno:{n:'Moderno',bg:'#FFFFFF',text:'#52607A',title:'#0F172A',sub:'#64748B',grid:'dash',gridC:'#E2E8F0',radius:6,fill:'gradient',axisLine:false,thick:false},
  clasico:{n:'Clásico',bg:'#FFFFFF',text:'#404040',title:'#404040',sub:'#595959',grid:'solid',gridC:'#D9D9D9',radius:0,fill:'solid',axisLine:true,thick:false},
  minimo:{n:'Minimalista',bg:'#FFFFFF',text:'#64748B',title:'#1E293B',sub:'#94A3B8',grid:'none',gridC:'#EEF2F7',radius:3,fill:'solid',axisLine:true,thick:false},
  suave:{n:'Suave',bg:'#F8FAFC',text:'#52607A',title:'#1E293B',sub:'#64748B',grid:'solid',gridC:'#E8EDF4',radius:5,fill:'soft',axisLine:false,thick:false},
  oscuro:{n:'Oscuro',bg:'#0F1B2D',text:'#B6C2D6',title:'#FFFFFF',sub:'#8FA0BA',grid:'dash',gridC:'#26364F',radius:5,fill:'gradient',axisLine:false,thick:false,dark:true},
  contraste:{n:'Contraste',bg:'#FFFFFF',text:'#111827',title:'#111827',sub:'#374151',grid:'solid',gridC:'#CBD5E1',radius:2,fill:'solid',axisLine:true,thick:true,bold:true}
};

const TIPOS_GRAF={
  bar:{n:'Columnas',i:'bar'}, barh:{n:'Barras',i:'barh'}, line:{n:'Líneas',i:'line'}, area:{n:'Áreas',i:'area'},
  pie:{n:'Circular',i:'pie'}, doughnut:{n:'Anillo',i:'doughnut'}, combo:{n:'Combinado',i:'combo'}
};
const BASE_CFG={type:'bar',style:'moderno',palette:'institucional',showTitle:true,title:'',subtitle:true,labels:true,grid:true,
  legend:'auto',trend:false,axisTitles:false,smooth:true,stacked:false,vary:false,h:380,groupBy:'tad',split:'none',measure:'count',order:'desc',top:0,ribbon:false,ocultas:[]};

/* ---------- Utilidades de color ---------- */
const hexRgb=h=>{h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.substr(i,2),16));};
const rgba=(h,a)=>{const [r,g,b]=hexRgb(h);return `rgba(${r},${g},${b},${a})`;};
function degradado(chart,color,horiz,a0,a1){
  const a=chart.chartArea; if(!a) return color;
  const g=horiz?chart.ctx.createLinearGradient(a.left,0,a.right,0):chart.ctx.createLinearGradient(0,a.top,0,a.bottom);
  g.addColorStop(0,rgba(color,horiz?a1:a0)); g.addColorStop(1,rgba(color,horiz?a0:a1)); return g;
}

/* ---------- Plugins propios de Chart.js ---------- */
const PLG_FONDO={id:'fondo',beforeDraw(chart,_a,o){
  if(!o||!o.color) return; const {ctx,width,height}=chart; ctx.save(); ctx.fillStyle=o.color; ctx.fillRect(0,0,width,height); ctx.restore();
}};
const PLG_ETIQ={id:'etiquetas',afterDatasetsDraw(chart,_a,o){
  if(!o||!o.on) return;
  const ctx=chart.ctx; ctx.save();
  ctx.font=`600 ${o.size||11}px Inter,system-ui,sans-serif`; ctx.textBaseline='middle';
  let halo=false;
  /* Cuantas rayas se estan dibujando: con seis series sobre 20 TAD serian 120 numeros encimados. */
  const series=chart.data.datasets.filter((d,i)=>!d._tendencia&&!chart.getDatasetMeta(i).hidden).length||1;
  chart.data.datasets.forEach((ds,di)=>{
    if(ds._tendencia) return;
    const meta=chart.getDatasetMeta(di); if(meta.hidden) return;
    meta.data.forEach((el,i)=>{
      const v=ds.data[i]; if(v==null||el.skip) return;
      const txt=o.fmt(v); let x,y,col=o.color; ctx.textAlign='center'; halo=false;
      if(meta.type==='bar'){
        if(!v) return;
        const p=el.getProps(['x','y','base','width','height'],true);
        /* Dentro de la barra el numero va con el color del texto (negro en los estilos claros) y un
           halo del fondo detras: el degradado de la serie aclara la barra de arriba abajo. */
        if(o.horiz){ if(o.stacked){x=(p.x+p.base)/2;y=p.y;halo=true;} else {x=p.x+7;y=p.y;ctx.textAlign='left';} }
        else if(o.stacked){x=p.x;y=(p.y+p.base)/2;halo=true;}
        else {x=p.x;y=p.y-10;}
      }else if(meta.type==='line'){ if(o.n>40||o.n*series>60) return; /* muchas rayas con numero se enciman: mejor la linea y el tooltip */ x=el.x; y=el.y-12; }
      else{
        const p=el.getProps(['x','y','startAngle','endAngle','innerRadius','outerRadius'],true);
        if(!v||p.endAngle-p.startAngle<.2) return;
        const a=(p.startAngle+p.endAngle)/2, r=(p.innerRadius+p.outerRadius)/2;
        x=p.x+Math.cos(a)*r; y=p.y+Math.sin(a)*r; col='#fff';
      }
      if(halo&&o.halo){ctx.lineWidth=3;ctx.lineJoin='round';ctx.strokeStyle=o.halo;ctx.strokeText(txt,x,y);}
      ctx.fillStyle=col; ctx.fillText(txt,x,y);
    });
  });
  ctx.restore();
}};
if(typeof Chart!=='undefined'){
  Chart.register(PLG_FONDO,PLG_ETIQ);
  Chart.defaults.font.family="Inter,system-ui,'Segoe UI',Roboto,Arial,sans-serif";
  Chart.defaults.font.size=11;
}

/* ---------- Estado del estudio ---------- */
const STUDIO={}, CHARTS={};
let SAVED={};
try{SAVED=JSON.parse(localStorage.getItem('pemex_graficas_v1')||'{}')||{};}catch(e){SAVED={};}
function guardarCfg(id,cfg){SAVED[id]=cfg;try{localStorage.setItem('pemex_graficas_v1',JSON.stringify(SAVED));}catch(e){}}
function olvidarCfg(id){delete SAVED[id];try{localStorage.setItem('pemex_graficas_v1',JSON.stringify(SAVED));}catch(e){}}

/* Ajustes que cambian con una nueva version del panel: se aplican UNA vez al navegador y
   despues el usuario queda libre de elegir lo que quiera. */
const MIGRACION=5;
if(SAVED._migracion!==MIGRACION){
  if(SAVED.general&&SAVED.general.split==='estatus') SAVED.general.split='tipo';
  /* Version 5: en la general cada tipo es una raya propia en cualquier dimension, todas encendidas.
     Se rehace el diseno guardado porque el anterior venia con series apagadas y la suma por categoria. */
  if(SAVED.general){ SAVED.general.split=SAVED.general.groupBy==='tipo'?'none':'tipo'; SAVED.general.type='line'; SAVED.general.ocultas=[]; }
  /* Un tipo que el panel ya no muestra no debe seguir cargando una serie apagada de un diseno viejo. */
  Object.keys(SAVED).forEach(k=>{const c=SAVED[k]; if(c&&Array.isArray(c.ocultas)) c.ocultas=[...new Set(c.ocultas.filter(t=>!OCULTOS.includes(t)))];});
  /* La serie que se apago como "Frenado de pánico" eran en realidad los 178 eventos de 'Freno nivel alto':
     se sigue llamando como se llamaba antes de saber el nombre verdadero, así el usuario ve lo mismo. */
  if(SAVED.general&&Array.isArray(SAVED.general.ocultas))
    SAVED.general.ocultas=SAVED.general.ocultas.map(t=>t===T.FR?T.FH:t);
  /* RPM: las dos series (con y sin pedal) arrancan apiladas una sobre otra. */
  if(SAVED.mod_rpm){ SAVED.mod_rpm.split='tipo'; SAVED.mod_rpm.stacked=true; }
  SAVED._migracion=MIGRACION;
  try{localStorage.setItem('pemex_graficas_v1',JSON.stringify(SAVED));}catch(e){}
}

function cfgInicial(def,usarGuardado=true){
  const cfg=Object.assign({},BASE_CFG,def.defaults||{},usarGuardado?(SAVED[def.id]||{}):{});
  if(!def.types.includes(cfg.type)) cfg.type=(def.defaults&&def.defaults.type)||def.types[0];
  if(def.dims&&!def.dims.includes(cfg.groupBy)) cfg.groupBy=def.defaults.groupBy;
  if(!def.splits||!def.splits.some(s=>s[0]===cfg.split)) cfg.split='none';
  if(!def.measures||!def.measures.some(m=>m[0]===cfg.measure)) cfg.measure='count';
  if(!ESTILOS[cfg.style]) cfg.style='moderno';
  if(!PALETAS[cfg.palette]) cfg.palette='institucional';
  cfg.labels=true;   /* las etiquetas de datos van siempre activas, no es una opcion */
  return cfg;
}

function destruirGraficas(){
  Object.keys(CHARTS).forEach(k=>{try{CHARTS[k].destroy();}catch(e){} delete CHARTS[k];});
}

/* Al elegir uno o dos TAD en los filtros, las gráficas pasan a "mes con mes" para poder seguir
   la serie de cada terminal. La bandera la prende 07_app.js solo cuando cambia el filtro de TAD,
   asi el usuario puede volver a lo que quiera despues de eso. */
let SUGIERE_MES=false;
function sugerirMes(st){
  const {def,cfg}=st;
  if(!def.dims||!def.dims.includes('mes')) return;
  const pd=porDimDefecto('mes');
  cfg.groupBy='mes'; cfg.order=pd.order; cfg.top=pd.top; cfg.type=tipoPorDim(def,'mes');
  if(S.tad.length>1&&def.splits&&def.splits.some(s=>s[0]==='tad')) cfg.split='tad';
  else { const sp=splitPorDim(def,'mes'); if(sp) cfg.split=sp; }
  guardarCfg(def.id,cfg);
}

/* Al repintar por una modificacion (marcar Descartada, guardar un motivo, traer novedades de otra
   laptop) la grafica NO debe volver a crecer desde cero: es ruido encima de un cambio chiquito.
   Desde el 2026-11-04 (2) la animacion de Chart.js queda reservada a la PRIMERA vez que esa grafica se
   dibuja en la sesion (`st.pintada`); todo lo que venga despues —ajustes de la cinta de diseno, "Ver
   por", tipo, estilo, filtros— repinta al instante. GRAF_QUIETA sigue sirviendo para que un repintado
   externo (refresco, estatus) no dispare esa unica animacion. */
let GRAF_QUIETA=false;
function sinAnimacionDeGraficas(fn){
  const antes=GRAF_QUIETA;GRAF_QUIETA=true;
  try{fn();}finally{GRAF_QUIETA=antes;}
}

/* Monta (o vuelve a montar) una gráfica dentro del contenedor `sel`. */
function mountStudio(sel,def){
  const host=$(sel); if(!host) return;
  if(typeof Chart==='undefined'){host.innerHTML='<div class="empty">No se pudo cargar la librería de gráficas.</div>';return;}
  let st=STUDIO[def.id];
  if(!st) st=STUDIO[def.id]={cfg:cfgInicial(def),open:null};
  st.def=def; st.host=host;
  if(SUGIERE_MES) sugerirMes(st);
  host.innerHTML=`<div class="cs"><div class="cs-quick" data-r="quick"></div><div class="cs-bar" data-r="bar" role="toolbar" aria-label="Diseño de gráfico"></div><div class="cs-box"><canvas aria-label="Gráfica"></canvas><div class="cs-empty" hidden>Sin datos para graficar con los filtros actuales.</div></div></div>`;
  pintarBarra(st); dibujar(st,GRAF_QUIETA);
}

/* ---------- Datos: orden y "mostrar los N primeros" ---------- */
function preparar(st){
  const {def,cfg}=st, d=def.build(cfg);
  const n=d.labels.length, tot=i=>d.series.reduce((a,s)=>a+(+s.values[i]||0),0);
  let idx=[...Array(n).keys()];
  const top=+cfg.top||0;
  if(top&&top<n) idx=idx.sort((a,b)=>tot(b)-tot(a)).slice(0,top).sort((a,b)=>a-b);
  if(cfg.order==='desc') idx.sort((a,b)=>tot(b)-tot(a)); else if(cfg.order==='asc') idx.sort((a,b)=>tot(a)-tot(b));
  const pick=a=>idx.map(i=>a[i]);
  d.labels=pick(d.labels); if(d.keys) d.keys=pick(d.keys);
  d.series=d.series.map(s=>Object.assign({},s,{values:pick(s.values)}));
  if(d.y2) d.y2=Object.assign({},d.y2,{values:pick(d.y2.values)});
  return d;
}

/* ---------- Dibujo con Chart.js ---------- */
function regresion(v){
  const n=v.length; if(n<2) return null;
  let sx=0,sy=0,sxy=0,sxx=0; v.forEach((y,x)=>{sx+=x;sy+=y;sxy+=x*y;sxx+=x*x;});
  const den=n*sxx-sx*sx; if(!den) return null;
  const m=(n*sxy-sx*sy)/den, b=(sy-m*sx)/n; return v.map((_,x)=>Math.round((m*x+b)*100)/100);
}
function dibujar(st,quieto){
  const {def,cfg,host}=st, id=def.id;
  const box=$('.cs-box',host), cv=$('canvas',host), vacio=$('.cs-empty',host); if(!cv) return;
  if(CHARTS[id]){try{CHARTS[id].destroy();}catch(e){} delete CHARTS[id];}
  const d=preparar(st), S_=ESTILOS[cfg.style], pal=PALETAS[cfg.palette].c;
  st.datos=d;
  box.style.height=cfg.h+'px'; box.style.background=S_.bg;
  const hayDatos=d.labels.length&&d.series.some(s=>s.values.some(v=>v>0));
  vacio.hidden=!!hayDatos; vacio.style.color=S_.text; cv.style.visibility=hayDatos?'visible':'hidden';
  if(!hayDatos) return;

  let tipo=cfg.type; if(tipo==='combo'&&!d.y2) tipo='bar';
  const circ=tipo==='pie'||tipo==='doughnut', horiz=tipo==='barh', esLinea=tipo==='line'||tipo==='area';
  const apilar=!!cfg.stacked&&d.series.length>1&&!circ&&tipo!=='line'&&tipo!=='combo';
  /* Cuando la grafica va por terminal, cada barra lleva su propio color sin que haya que activarlo. */
  const variar=!!cfg.vary||cfg.groupBy==='tad';
  const colorDe=(s,i)=>(cfg.palette==='institucional'&&cfg.split==='estatus'&&COLOR_ESTATUS[s.name])||pal[i%pal.length];
  /* Series apagadas (se prenden o apagan dando clic en la leyenda y se recuerdan). */
  const ocultas=new Set(Array.isArray(cfg.ocultas)?cfg.ocultas:[]);
  const datasets=[];

  if(circ){
    const vals=d.labels.map((_,i)=>d.series.reduce((a,s)=>a+(+s.values[i]||0),0));
    datasets.push({data:vals,backgroundColor:d.labels.map((_,i)=>pal[i%pal.length]),borderColor:S_.bg,borderWidth:2,hoverOffset:8});
  }else{
    d.series.forEach((s,i)=>{
      const col=colorDe(s,i), ds={label:s.name,data:s.values,_col:col};
      if(ocultas.has(s.name)) ds.hidden=true;
      if(esLinea){
        ds.type='line'; ds.borderColor=col; ds.borderWidth=S_.thick?3.5:2.5; ds.tension=cfg.smooth?.3:0; if(cfg.smooth) ds.cubicInterpolationMode='monotone';
        ds.pointRadius=d.labels.length>45?0:(S_.thick?4.5:3.5); ds.pointHoverRadius=6; ds.pointBackgroundColor=S_.bg; ds.pointBorderColor=col; ds.pointBorderWidth=2;
        if(tipo==='area'){ds.fill=apilar?true:'origin'; ds.backgroundColor=c=>degradado(c.chart,col,false,.38,.03);} else ds.fill=false;
      }else{
        ds.type='bar'; ds.borderRadius=S_.radius; ds.maxBarThickness=S_.thick?70:48; ds.borderSkipped=apilar?false:'start';
        if(variar&&d.series.length===1) ds.backgroundColor=d.labels.map((_,k)=>pal[k%pal.length]);
        else if(S_.fill==='gradient') ds.backgroundColor=c=>degradado(c.chart,col,horiz,.95,.62);
        else if(S_.fill==='soft'){ds.backgroundColor=rgba(col,.28);ds.borderColor=col;ds.borderWidth=1.5;}
        else ds.backgroundColor=col;
      }
      datasets.push(ds);
    });
    const c2=pal[1%pal.length];
    if(tipo==='combo'&&d.y2){
      datasets.push({type:'line',label:d.y2.name,data:d.y2.values,yAxisID:'y2',borderColor:c2,borderWidth:2.5,tension:cfg.smooth?.3:0,cubicInterpolationMode:cfg.smooth?'monotone':'default',pointRadius:4,pointBackgroundColor:S_.bg,pointBorderColor:c2,pointBorderWidth:2,order:0});
    }
    if(cfg.trend&&!horiz&&d.labels.length>=2){
      const base=datasets.filter(x=>!x.yAxisID).slice(0,4);
      base.forEach((b,k)=>{
        const f=regresion(b.data.map(v=>+v||0)); if(!f) return;
        const col=base.length===1?(S_.dark?'#7DD3A8':'#2E7D32'):b._col;
        datasets.push({type:'line',label:'Tendencia'+(base.length>1?' ('+b.label+')':''),data:f,borderColor:col,borderDash:[7,5],borderWidth:2,pointRadius:0,pointHoverRadius:0,fill:false,tension:0,order:0,_tendencia:true,_base:b.label,hidden:ocultas.has(b.label)});
      });
    }
  }

  const gridOn=cfg.grid&&S_.grid!=='none', vKey=horiz?'x':'y', cKey=horiz?'y':'x';
  const tick={color:S_.text,font:{size:11,weight:S_.bold?'600':'400'}};
  const rejilla={display:gridOn,color:S_.gridC,drawTicks:false};
  const lineaEje=S_.dark?'#3A4B66':'#94A3B8';
  const tit=t=>({display:!!(cfg.axisTitles&&t),text:t||'',color:S_.text,font:{size:11,weight:'600'}});
  const scales={};
  if(!circ){
    scales[vKey]={beginAtZero:true,stacked:apilar,grid:rejilla,border:{display:S_.axisLine,color:lineaEje,dash:S_.grid==='dash'?[4,4]:[]},
      ticks:Object.assign({},tick,{precision:cfg.measure==='count'?0:undefined,padding:8}),title:tit(d.yTitle)};
    scales[cKey]={stacked:apilar,grid:{display:false},border:{display:S_.axisLine,color:lineaEje},
      ticks:Object.assign({},tick,{maxRotation:horiz?0:55,autoSkip:true,padding:6}),title:tit(d.xTitle)};
    if(tipo==='combo'&&d.y2) scales.y2={position:'right',beginAtZero:true,grid:{display:false},border:{display:false},
      ticks:Object.assign({},tick,{color:c2col()}),title:{display:!!cfg.axisTitles,text:d.y2.title,color:c2col(),font:{size:11,weight:'600'}}};
  }
  function c2col(){return pal[1%pal.length];}
  const nDs=datasets.length;
  const verLey=cfg.legend==='auto'?(circ||nDs>1):cfg.legend!=='off';
  const posLey=['top','bottom','left','right'].includes(cfg.legend)?cfg.legend:(circ?'right':'top');
  const unidad=d.unit||'';
  const fmt=v=>fnum(Math.round(v*10)/10);
  const opciones={
    responsive:true,maintainAspectRatio:false,devicePixelRatio:Math.max(2,window.devicePixelRatio||1),
    animation:(quieto||GRAF_QUIETA||st.pintada)?false:{duration:450},
    layout:{padding:{top:cfg.labels?16:4,right:10,left:4,bottom:4}},
    interaction:{mode:circ?'nearest':'index',intersect:circ},
    indexAxis:horiz?'y':'x',
    scales,
    plugins:{
      fondo:{color:S_.bg},
      etiquetas:{on:!!cfg.labels,n:d.labels.length,color:S_.dark?'#E2E8F0':S_.title,halo:S_.bg,horiz,stacked:apilar,fmt},
      legend:{display:verLey,position:posLey,labels:{color:S_.text,usePointStyle:true,pointStyle:'rectRounded',boxWidth:9,boxHeight:9,padding:16,font:{size:11,weight:S_.bold?'600':'400'}},
        /* Al apagar una serie desde la leyenda se anota en el diseno: al recargar sigue igual,
          y la linea de tendencia de esa serie se apaga con ella. Las circulares mantienen su clic de siempre. */
        ...(circ?{}:{onClick:(ev,item,leg)=>{
          const ch=leg&&leg.chart; if(!ch) return;
          const ds=ch.data.datasets[item.datasetIndex]; if(!ds) return;
          const s=new Set(cfg.ocultas||[]), nm=ds._base||ds.label;
          if(s.has(nm)) s.delete(nm); else s.add(nm);
          cfg.ocultas=[...s]; guardarCfg(def.id,cfg);
          ch.data.datasets.forEach((d2,i2)=>ch.setDatasetVisibility(i2,!s.has(d2._base||d2.label)));
          ch.update();
        }})},
      title:{display:!!cfg.showTitle,text:cfg.title||d.title,color:S_.title,align:'center',font:{size:16,weight:'700',family:"Manrope,Inter,system-ui,sans-serif"},padding:{top:8,bottom:cfg.subtitle&&d.subtitle?2:14}},
      subtitle:{display:!!(cfg.showTitle&&cfg.subtitle&&d.subtitle),text:d.subtitle||'',color:S_.sub,font:{size:11},padding:{bottom:14}},
      tooltip:{backgroundColor:'rgba(15,23,42,.94)',titleColor:'#fff',bodyColor:'#E2E8F0',padding:10,cornerRadius:6,boxPadding:4,titleFont:{weight:'700'},
        callbacks:{
          label:c=>{
            const ds=c.dataset;
            if(circ){const t=ds.data.reduce((a,b)=>a+b,0);return ` ${c.label}: ${fmt(c.raw)}${unidad}  (${t?Math.round(c.raw/t*100):0}%)`;}
            const v=c.parsed[vKey], u=ds.yAxisID==='y2'?(d.y2.unit||''):unidad;
            return ` ${ds.label}: ${fmt(v)}${u}`;
          },
          afterBody:()=>def.onClick&&def.hint?['',typeof def.hint==='function'?def.hint(cfg.groupBy):def.hint]:[]
        }}
    },
    onClick:(ev,_els,chart)=>{
      if(!def.onClick) return;
      const els=chart.getElementsAtEventForMode(ev,'nearest',{intersect:true},true);
      if(els.length){const i=els[0].index; def.onClick(d.keys?d.keys[i]:d.labels[i],d.labels[i],cfg,st);}
    },
    onHover:(ev,els)=>{ev.native.target.style.cursor=(def.onClick&&els.length)?'pointer':'default';}
  };
  CHARTS[id]=new Chart(cv,{type:circ?tipo:(esLinea?'line':'bar'),data:{labels:d.labels,datasets},options:opciones});
  st.pintada=true;
}

/* ---------- Cinta de opciones (estilo Excel) ---------- */
function miniEstilo(k){
  const e=ESTILOS[k], c=PALETAS.institucional.c[0], uid='g'+k, hs=[22,34,16,28];
  const g=e.fill==='gradient'?`<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset="1" stop-color="${c}" stop-opacity=".6"/></linearGradient></defs>`:'';
  const fill=e.fill==='gradient'?`url(#${uid})`:e.fill==='soft'?rgba(c,.3):c;
  let s=`<svg viewBox="0 0 84 52" width="84" height="52" aria-hidden="true">${g}<rect width="84" height="52" rx="4" fill="${e.bg}"/>`;
  if(e.grid!=='none') [14,26,38].forEach(y=>s+=`<line x1="8" x2="78" y1="${y}" y2="${y}" stroke="${e.gridC}" stroke-width="1" ${e.grid==='dash'?'stroke-dasharray="3 3"':''}/>`);
  hs.forEach((h,i)=>s+=`<rect x="${14+i*16}" y="${44-h}" width="10" height="${h}" rx="${Math.min(e.radius,4)/1.5}" fill="${fill}" ${e.fill==='soft'?`stroke="${c}"`:''}/>`);
  s+=`<line x1="8" x2="78" y1="44" y2="44" stroke="${e.axisLine?(e.dark?'#3A4B66':'#94A3B8'):'transparent'}"/></svg>`;
  return s;
}
const opt=(st,k,v,txt)=>`<option value="${esc(v)}" ${String(st.cfg[k])===String(v)?'selected':''}>${esc(txt)}</option>`;
const chk=(st,k,txt,dis=false)=>`<label class="cs-chk ${dis?'dis':''}"><input type="checkbox" data-sa="tog" data-sid="${st.def.id}" data-k="${k}" ${st.cfg[k]?'checked':''} ${dis?'disabled':''}><span>${txt}</span></label>`;

function pintarBarra(st){
  const {def,cfg}=st, id=def.id, abierto=cfg.ribbon?st.open:null;
  const q=$('[data-r="quick"]',st.host), bar=$('[data-r="bar"]',st.host); if(!bar) return;
  const verPor=def.quick&&def.dims?`<span>Ver por</span><div class="seg" role="group" aria-label="Agrupar gráfica por">${def.quick.map(k=>`<button type="button" data-sa="set" data-sid="${id}" data-k="groupBy" data-v="${k}" aria-pressed="${cfg.groupBy===k}">${DIMS[k].n}</button>`).join('')}</div>`:'';
  const porTipo=def.tipos?`<span>Tipo de evento</span><div class="seg cs-tipos" role="group" aria-label="Filtrar por tipo de evento">${TIPOS_GENERAL.map(t=>`<button type="button" data-sa="tipo" data-sid="${id}" data-v="${esc(t)}" aria-pressed="${S.tipo.includes(t)}">${esc(t)}</button>`).join('')}</div>`:'';
  q.innerHTML=verPor+porTipo+`<span class="cs-quick-fin"></span><button type="button" class="btn sm cs-dis" data-sa="ribbon" data-sid="${id}" aria-pressed="${!!cfg.ribbon}" title="Mostrar u ocultar las opciones de diseño de la gráfica">${ico('palette',15)}<span>Diseño</span></button>`;
  const btn=(k,ic,txt,pop,right)=>`<div class="cs-wrap"><button type="button" class="cs-btn ${abierto===k?'on':''}" data-sa="pop" data-sid="${id}" data-v="${k}" aria-expanded="${abierto===k}" aria-haspopup="true">${ico(ic,22)}<span>${txt}<i>${ico('chev',10)}</i></span></button>${abierto===k?`<div class="cs-pop ${right?'r':''}" role="dialog" aria-label="${txt}">${pop}</div>`:''}</div>`;

  const popTipo=`<h5>Cambiar tipo de gráfico</h5><div class="cs-grid g4">${def.types.map(t=>`<button type="button" class="cs-opt ${cfg.type===t?'on':''}" data-sa="set" data-sid="${id}" data-k="type" data-v="${t}">${ico(TIPOS_GRAF[t].i,26)}<span>${TIPOS_GRAF[t].n}</span></button>`).join('')}</div>`;
  const popEstilo=`<h5>Estilos de diseño</h5><div class="cs-grid g3">${Object.keys(ESTILOS).map(k=>`<button type="button" class="cs-sty ${cfg.style===k?'on':''}" data-sa="set" data-sid="${id}" data-k="style" data-v="${k}">${miniEstilo(k)}<span>${ESTILOS[k].n}</span></button>`).join('')}</div>`;
  const popColor=`<h5>Cambiar colores</h5>${Object.keys(PALETAS).map(k=>`<button type="button" class="cs-pal ${cfg.palette===k?'on':''}" data-sa="set" data-sid="${id}" data-k="palette" data-v="${k}"><span class="sw">${PALETAS[k].c.slice(0,6).map(c=>`<i style="background:${c}"></i>`).join('')}</span><span>${PALETAS[k].n}</span></button>`).join('')}`;
  const circ=cfg.type==='pie'||cfg.type==='doughnut', lineal=cfg.type==='line'||cfg.type==='area';
  const popElem=`<h5>Agregar elemento de gráfico</h5>
    <label class="cs-field"><span>Título del gráfico</span><input type="text" data-sid="${id}" data-sk="title" placeholder="${esc((st.datos&&st.datos.title)||'Escribe un título')}" value="${esc(cfg.title)}"></label>
    ${chk(st,'showTitle','Mostrar título')}${chk(st,'subtitle','Subtítulo con periodo y filtros')}${chk(st,'grid','Líneas de cuadrícula',circ)}${chk(st,'axisTitles','Títulos de los ejes',circ)}${chk(st,'trend','Línea de tendencia',circ||cfg.type==='barh')}${lineal?chk(st,'smooth','Líneas suavizadas'):''}${chk(st,'stacked','Apilar series',circ||cfg.type==='line'||cfg.type==='combo')}${chk(st,'vary','Variar colores por punto',circ)}
    <div class="cs-row"><label class="cs-field"><span>Leyenda</span><select data-sid="${id}" data-sk="legend">${opt(st,'legend','auto','Automática')}${opt(st,'legend','top','Arriba')}${opt(st,'legend','bottom','Abajo')}${opt(st,'legend','right','Derecha')}${opt(st,'legend','left','Izquierda')}${opt(st,'legend','off','Ocultar')}</select></label>
    <label class="cs-field"><span>Alto</span><select data-sid="${id}" data-sk="h" data-n="1">${opt(st,'h',300,'Compacto')}${opt(st,'h',380,'Normal')}${opt(st,'h',480,'Alto')}${opt(st,'h',600,'Muy alto')}</select></label></div>`;
  const popDatos=`<h5>Seleccionar datos</h5>
    ${def.dims?`<label class="cs-field"><span>Agrupar por (eje horizontal)</span><select data-sid="${id}" data-sk="groupBy">${def.dims.map(k=>opt(st,'groupBy',k,DIMS[k].n)).join('')}</select></label>`:''}
    ${def.splits?`<label class="cs-field"><span>Dividir en series por</span><select data-sid="${id}" data-sk="split">${def.splits.map(s=>opt(st,'split',s[0],s[1])).join('')}</select></label>`:''}
    ${def.measures&&def.measures.length>1?`<label class="cs-field"><span>Valor a graficar</span><select data-sid="${id}" data-sk="measure">${def.measures.map(m=>opt(st,'measure',m[0],m[1])).join('')}</select></label>`:''}
    ${def.dims?`<div class="cs-row"><label class="cs-field"><span>Ordenar</span><select data-sid="${id}" data-sk="order">${opt(st,'order','natural','Original (cronológico)')}${opt(st,'order','desc','Mayor a menor')}${opt(st,'order','asc','Menor a mayor')}</select></label>
    <label class="cs-field"><span>Mostrar</span><select data-sid="${id}" data-sk="top" data-n="1">${opt(st,'top',0,'Todos')}${opt(st,'top',5,'Los 5 primeros')}${opt(st,'top',10,'Los 10 primeros')}${opt(st,'top',15,'Los 15 primeros')}${opt(st,'top',20,'Los 20 primeros')}</select></label></div>`:''}`;
  const popExp=`<h5>Exportar gráfica</h5>
    <button type="button" class="cs-item" data-sa="png" data-sid="${id}">${ico('image',18)}<span><b>Descargar imagen (PNG)</b><small>Lista para Word, PowerPoint o correo</small></span></button>
    <button type="button" class="cs-item" data-sa="copy" data-sid="${id}">${ico('copy',18)}<span><b>Copiar imagen</b><small>Después pega con Ctrl+V</small></span></button>
    <button type="button" class="cs-item" data-sa="csv" data-sid="${id}">${ico('sheet',18)}<span><b>Datos de la gráfica (Excel)</b><small>Abre en Excel como tabla</small></span></button>`;

  bar.hidden=!cfg.ribbon;
  bar.innerHTML=cfg.ribbon?(btn('tipo','combo','Tipo de gráfico',popTipo)+btn('estilo','layers','Estilos',popEstilo)+btn('color','palette','Colores',popColor)+'<span class="cs-sep"></span>'
    +btn('elem','plusc','Elementos',popElem)+(def.dims||def.splits?btn('datos','db','Datos',popDatos):'')+'<span class="cs-sep"></span>'
    +btn('exp','image','Exportar',popExp,true)
    +`<div class="cs-wrap"><button type="button" class="cs-btn" data-sa="reset" data-sid="${id}" title="Volver al diseño original">${ico('refresh',22)}<span>Restablecer</span></button></div>`):'';
}

/* ---------- Acciones ---------- */
/* El tipo que le conviene a cada dimension: el tiempo se lee en lineas y las categorias en barras,
   salvo en la general, que siempre va en rayas para poder comparar unos eventos con otros. */
function tipoPorDim(def,dim){
  const t=((DIMS[dim]&&DIMS[dim].chrono)||def.tipos)?'line':'bar';
  return def.types.includes(t)?t:def.types[0];
}
/* En la grafica general cada tipo es su propia serie en cualquier dimension: por TAD se ve cuanto
   aporta cada evento y no solo la suma. "Tipo de evento" queda fuera porque ahi cada categoria ya es un tipo. */
function splitPorDim(def,dim){
  if(!def.tipos||!def.splits) return null;
  const v=dim==='tipo'?'none':'tipo';
  return def.splits.some(s=>s[0]===v)?v:null;
}
function aplicarCambio(st,k,v){
  const cfg=st.cfg;
  cfg[k]=v;
  if(k==='groupBy'){
    const dk=DIMS[v]; cfg.order=dk.chrono?'natural':'desc'; cfg.top=(v==='conductor'||v==='unidad')?10:0; cfg.type=tipoPorDim(st.def,v);
    const sp=splitPorDim(st.def,v); if(sp) cfg.split=sp;
  }
  guardarCfg(st.def.id,cfg);
}
/* Descenso de nivel al tocar una barra de tiempo (2026-11-04, lo pidio el usuario): el mes manda a
   los dias del mes y el dia manda a las horas del dia. Lo unico que hace aqui es moverle el eje a ESA
   grafica; el filtro ya se aplico aparte en clicGrafica. Por eso "Ver por" y "Agrupar por" siguen
   libres para regresar el usuario a mano cuando quiera, y si la grafica no tiene ese eje entre sus
   dimensiones no se toca nada. */
function llevarEje(st,dim){
  if(!st||!st.cfg||!st.def||!st.def.dims||!st.def.dims.includes(dim)) return false;
  if(st.cfg.groupBy===dim) return false;
  aplicarCambio(st,'groupBy',dim);
  return true;
}
function cerrarPops(){Object.values(STUDIO).forEach(st=>{if(st.open){st.open=null;pintarBarra(st);}});}
function nombreArchivo(st){return (st.cfg.title||(st.datos&&st.datos.title)||'grafica').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,60)||'grafica';}
function descargar(href,nombre){const a=document.createElement('a');a.href=href;a.download=nombre;document.body.appendChild(a);a.click();a.remove();}
function exportarPNG(st){const ch=CHARTS[st.def.id]; if(!ch) return; descargar(ch.toBase64Image('image/png',1),nombreArchivo(st)+'.png'); toast('Imagen descargada: '+nombreArchivo(st)+'.png');}
function copiarImagen(st){
  const ch=CHARTS[st.def.id]; if(!ch) return;
  ch.canvas.toBlob(async b=>{
    try{await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);toast('Imagen copiada. Pégala con Ctrl+V en Word, Excel o PowerPoint.');}
    catch(e){exportarPNG(st);toast('Este equipo no permite copiar: se descargó la imagen.');}
  },'image/png');
}
function exportarDatos(st){
  const d=st.datos; if(!d) return;
  const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const cols=d.series.map(s=>s.name).concat(d.y2?[d.y2.name]:[]);
  const filas=d.labels.map((l,i)=>[l].concat(d.series.map(s=>s.values[i]),d.y2?[d.y2.values[i]]:[]));
  const csv='\ufeff'+[[d.xTitle||'Categoría'].concat(cols).map(q).join(',')].concat(filas.map(r=>r.map(q).join(','))).join('\r\n');
  descargar(URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),nombreArchivo(st)+'.csv');
  toast('Datos exportados: se abren en Excel.');
}

document.addEventListener('click',e=>{
  const a=e.target.closest('[data-sa]');
  if(!a){ if(!e.target.closest('.cs-pop')) cerrarPops(); return; }
  const st=STUDIO[a.dataset.sid]; if(!st) return;
  const act=a.dataset.sa;
  if(act==='pop'){const v=a.dataset.v; Object.values(STUDIO).forEach(o=>{if(o!==st&&o.open){o.open=null;pintarBarra(o);}}); st.open=st.open===v?null:v; return pintarBarra(st);}
  if(act==='ribbon'){st.cfg.ribbon=!st.cfg.ribbon; st.open=null; guardarCfg(st.def.id,st.cfg); return pintarBarra(st);}
  if(act==='tipo'){cerrarPops(); return alternar('tipo',a.dataset.v);}
  if(act==='set'){
    const k=a.dataset.k; aplicarCambio(st,k,a.dataset.v);
    if(k==='type') st.open=null;
    pintarBarra(st); return dibujar(st);
  }
  if(act==='reset'){const cinta=st.cfg.ribbon; st.cfg=cfgInicial(st.def,false); st.cfg.ribbon=cinta; olvidarCfg(st.def.id); if(cinta) guardarCfg(st.def.id,st.cfg); st.open=null;pintarBarra(st);dibujar(st);return toast('Gráfica restablecida al diseño original');}
  if(act==='png'){st.open=null;pintarBarra(st);return exportarPNG(st);}
  if(act==='copy'){st.open=null;pintarBarra(st);return copiarImagen(st);}
  if(act==='csv'){st.open=null;pintarBarra(st);return exportarDatos(st);}
});
document.addEventListener('change',e=>{
  const el=e.target, id=el.dataset&&el.dataset.sid; if(!id) return;
  const st=STUDIO[id]; if(!st) return;
  if(el.dataset.sa==='tog'){st.cfg[el.dataset.k]=el.checked;guardarCfg(id,st.cfg);pintarBarra(st);return dibujar(st);}
  if(el.dataset.sk&&el.tagName==='SELECT'){
    aplicarCambio(st,el.dataset.sk,el.dataset.n?+el.value:el.value);
    pintarBarra(st); dibujar(st);
  }
});
document.addEventListener('input',e=>{
  const el=e.target, id=el.dataset&&el.dataset.sid; if(!id||el.dataset.sk!=='title') return;
  const st=STUDIO[id]; if(!st) return;
  st.cfg.title=el.value; guardarCfg(id,st.cfg); dibujar(st,true);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape') cerrarPops();});
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>Object.values(CHARTS).forEach(c=>{try{c.update('none');}catch(e){}}));

/* ---------- Mini barras del boletín del conductor ----------
   Con `series` (un arreglo {n,c,v}) cada mes se dibuja apilando los tipos de evento, uno encima
   del otro y con el color de su tipo; sin series queda la barra simple de siempre. */
function miniBars(values,series){
  const W=360,H=120,m={t:8,b:22},max=Math.max(1,...values),bw=W/values.length,alto=a=>a/max*(H-m.t-m.b);
  const pila=Array.isArray(series)&&series.length;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Eventos por mes">`;
  values.forEach((v,i)=>{
    const x=i*bw+bw*.2, w=bw*.6;
    let tope=H-m.b;
    if(pila){
      series.forEach(k=>{
        const val=k.v[i]||0; if(!val) return;
        const h=alto(val); tope-=h;
        s+=`<rect x="${x}" y="${tope}" width="${w}" height="${h}" fill="${k.c}"/>`;
      });
    }else{
      const h=alto(v); tope=H-m.b-h;
      s+=`<rect x="${x}" y="${tope}" width="${w}" height="${h}" rx="3" fill="var(--green-bar)"/>`;
    }
    s+=`<text x="${i*bw+bw/2}" y="${H-7}" font-size="10.5" text-anchor="middle" fill="#5d6b64">${MES3[i]}</text>`;
    if(v) s+=`<text x="${i*bw+bw/2}" y="${tope-3}" font-size="10.5" text-anchor="middle" fill="#14201a" font-weight="600">${v}</text>`;
  });
  const ley=pila&&series.length>1?`<div class="minileg">${series.map(k=>`<span><i style="background:${k.c}"></i>${esc(k.n)}</span>`).join('')}</div>`:'';
  return s+'</svg>'+ley;
}
