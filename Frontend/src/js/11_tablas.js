/* 11_tablas: ajuste de ancho de columna como en Excel y cinta de diseño para todas las tablas.
   No toca los demas archivos: se engancha con un MutationObserver, asi que cualquier vista nueva
   (o un modal que se reescribe en cada clic) queda preparada sin editar 04_vistas.js ni 07_app.js.
   El diseno (estilo, opciones, densidad y letra) es independiente por tabla: lo que se elija en la
   cinta solo cambia ESA tabla, y el boton "Igualar todas" copia ese diseno a las demas.
   El reporte del correo (repBody) queda fuera: ese lleva su diseno fijo de 680 px porque Outlook
   renderiza con el motor de Word y no admite mangos ni clases. */
const TB_CLAVE='pemex_tablas_v1';
const TB_ESTILOS=[
  {k:'institucional',n:'Institucional',c:['#1F3864','#F3F6FB','#2F4B7C']},
  {k:'oficina',n:'Office claro',c:['#4472C4','#EEF3FB','#4472C4']},
  {k:'medio',n:'Office medio',c:['#2F5597','#DFE8F6','#2F5597']},
  {k:'oscuro',n:'Office oscuro',c:['#22304A','#ECEFF5','#14305A']},
  {k:'minimo',n:'Minimalista',c:['#FFFFFF','#FAFBFD','#94A3B8']},
  {k:'verde',n:'Verde PEMEX',c:['#14503B','#EEF7F1','#1E6B4F']},
  {k:'calidos',n:'Cálidos',c:['#8C2F39','#FBF1EC','#B3392F']},
  {k:'contraste',n:'Alto contraste',c:['#000000','#E9E9E9','#000000']}
];
const TB_OPS=[['cabFila','Encabezados de fila'],['cabCol','Encabezados de columna'],['bandF','Filas con bandas'],
  ['bandC','Columnas con bandas'],['prim','Primera columna'],['ult','Última columna'],
  ['res','Resaltar fila y columna activa']];
const TB_DENS=[['compacto','Compacto'],['normal','Normal'],['amplo','Amplio']];
const TB_MIN=46,TB_MAX=560;

function tbCopia(o){return JSON.parse(JSON.stringify(o));}
/* El diseno es POR TABLA: TB.def es el que heredan las que nunca se personalizaron y TB.tablas[clave]
   guarda solo lo que se le cambio a esa tabla. Antes uno solo valia para todo el panel y pintar una
   tabla de oscuro se llevaba puestas las demas. */
const TB_DEF={estilo:'institucional',dens:'normal',letra:11,
  op:{cabFila:false,cabCol:true,bandF:true,bandC:false,prim:false,ult:false,res:false}};
function tbDefecto(){return{def:tbCopia(TB_DEF),tablas:{},anchos:{},pop:'',popT:''};}
let TB=(function(){
  try{const g=JSON.parse(localStorage.getItem(TB_CLAVE)||'null');
    if(g&&g.tablas)return Object.assign(tbDefecto(),g,{def:Object.assign(tbCopia(TB_DEF),g.def||{},
      {op:Object.assign(tbCopia(TB_DEF.op),(g.def||{}).op)})});
    /* Version anterior: un solo diseno para todo el panel. Se conserva, pero ahora como el heredado,
       para que las tablas se vean igual que antes de este cambio y cada una se pueda separar despues. */
    if(g&&g.op)return Object.assign(tbDefecto(),{anchos:g.anchos||{},def:{
      estilo:g.estilo||TB_DEF.estilo,dens:g.dens||TB_DEF.dens,letra:+g.letra||TB_DEF.letra,
      op:Object.assign(tbCopia(TB_DEF.op),g.op)}});
  }catch(e){}
  return tbDefecto();
})();
/* El desplegable abierto (TB.pop) y la tabla a la que pertenece (TB.popT) son estado momentaneo: se
   quedan fuera del guardado para que al recargar el panel no aparezca una ventanita de diseno abierta
   sobre la tabla. */
function tbGuardar(){try{const{pop,popT,...g}=TB;localStorage.setItem(TB_CLAVE,JSON.stringify(g));}catch(e){}}
/* Diseno efectivo de una tabla: lo suyo si lo tiene, si no lo heredado de TB.def. Un estilo o una
   densidad que ya no estan en el catalogo caen de vuelta al heredado. */
function tbCfg(clave){
  const g=(clave&&TB.tablas[clave])||{},d=TB.def;
  return{estilo:TB_ESTILOS.some(e=>e.k===g.estilo)?g.estilo:d.estilo,
    dens:TB_DENS.some(x=>x[0]===g.dens)?g.dens:d.dens,
    letra:+g.letra||d.letra,cinta:!!g.cinta,op:Object.assign(tbCopia(d.op),g.op||{})};
}
/* Se guarda el ajuste suelto, no el diseno completo copiado de def: asi una tabla que solo cambio su
   letra sigue siguiendo los cambios que se le hagan despues al heredado. */
function tbSet(clave,parte){
  if(!clave)return;
  const a=TB.tablas[clave]||{};
  Object.keys(parte).forEach(k=>{
    if(k==='op')a.op=Object.assign(a.op||{},parte.op);else a[k]=parte[k];
  });
  TB.tablas[clave]=a;
}
function tbSlug(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28);}
function tbClaveDe(t){
  if(t.closest('#detail'))return'detalle-'+S.mod;
  if(t.classList.contains('cmp'))return'comparador';
  if(t.classList.contains('top5'))return'top5-'+S.mod;
  if(t.closest('.om-t'))return'omitidos';
  if(t.closest('.prs-t'))return'protocolos';
  const wrap=t.closest('.scroll')||t.parentElement;
  const cont=wrap&&wrap.parentElement;
  const cab=cont&&cont.querySelector('.panel-head,.mh');
  const ti=cab&&cab.querySelector('h2,h3');
  return'v-'+(ti?tbSlug(ti.textContent):S.mod);
}
function tbColumnas(t){
  const fila=t.tHead&&t.tHead.rows[0]?t.tHead.rows[0].cells:(t.rows[0]?t.rows[0].cells:null);
  return fila?fila.length:0;
}
function tbCols(t,n){
  const total=n||tbColumnas(t);
  let cg=t.querySelector('colgroup');
  if(!cg){cg=document.createElement('colgroup');t.insertBefore(cg,t.firstChild);}
  while(cg.children.length<total)cg.appendChild(document.createElement('col'));
  while(cg.children.length>total)cg.removeChild(cg.lastChild);
  return [...cg.children];
}
/* ---------- la letra sigue al fondo ----------
   Cada estilo trae sus colores y no siempre dejan una letra legible encima. Se mide la luminancia
   real del fondo de cada superficie (encabezado, renglon al pasar el raton, bandas, cruz, ultima
   columna) y se elige letra clara u oscura, que es lo que hace Excel. El resultado sale en
   --tb-tinta-<superficie> y lo leen las reglas de 13_tablas.css. */
const TB_TINTA_CLARA='#f4f7fb', TB_TINTA_OSCURA='#22304a';
const TB_SUPERFICIES=['head','fondo','fondo-alt','band','hover','fila','selec','selec-col'];
function tbRgb(txt){
  const s=String(txt||'').trim().toLowerCase();
  let m=/^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if(m){const h=m[1].length===3?m[1].replace(/./g,c=>c+c):m[1];
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  m=/rgba?\(([^)]+)\)/.exec(s);
  if(m){const p=m[1].split(/[^\d.]+/).filter(x=>x!=='').map(Number);
    return p.length>=3?[p[0],p[1],p[2]]:null;}
  return null;
}
/* true = fondo oscuro (letra clara), false = fondo claro (letra oscura), null = no se puede medir. */
function tbFondoOscuro(txt){
  const c=tbRgb(txt); if(!c) return null;
  const l=c.map(v=>{const x=v/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4);});
  return .2126*l[0]+.7152*l[1]+.0722*l[2]<.35;
}
function tbTintas(t){
  const cs=getComputedStyle(t);
  TB_SUPERFICIES.forEach(k=>{
    const osc=tbFondoOscuro(cs.getPropertyValue('--tb-'+k));
    /* Si el color viene en un formato que no se mide (oklch, un nombre), se respeta la letra que
       puso el propio estilo en lugar de adivinar. */
    const tinta=osc===null?(k==='head'?(cs.getPropertyValue('--tb-head-ink').trim()||TB_TINTA_OSCURA):TB_TINTA_OSCURA)
      :(osc?TB_TINTA_CLARA:TB_TINTA_OSCURA);
    t.style.setProperty('--tb-tinta-'+k,tinta);
  });
}
function tbMini(e){
  const[head,band,acc]=e.c,claro=head==='#FFFFFF';
  return `<svg class="tb-mini" viewBox="0 0 76 46" role="img" aria-label="${esc(e.n)}">`
    +`<rect x="0" y="0" width="76" height="46" fill="#fff"/>`
    +`<rect x="0" y="0" width="76" height="11" fill="${head}"/>`
    +`<rect x="4" y="4" width="26" height="3" fill="${claro?'#8795a9':'#fff'}" opacity=".9"/>`
    +`<rect x="38" y="4" width="14" height="3" fill="${claro?'#8795a9':'#fff'}" opacity=".6"/>`
    +[0,1,2,3].map(i=>`<rect x="0" y="${12+i*8}" width="76" height="8" fill="${i%2?band:'#fff'}"/>`
      +`<rect x="4" y="${15+i*8}" width="${22-i*2}" height="2" fill="#9aa7b8"/>`
      +`<rect x="38" y="${15+i*8}" width="12" height="2" fill="#9aa7b8"/>`).join('')
    +`<rect x="0" y="0" width="2.5" height="46" fill="${acc}"/></svg>`;
}
/* La cinta vive pegada arriba de su tabla: [boton en el encabezado] / [cinta] / [.scroll con la tabla]. */
function tbBarra(t){
  const wrap=t.closest('.scroll')||t.parentElement;
  if(!wrap)return null;
  let cinta=wrap.previousElementSibling;
  if(cinta&&cinta.classList.contains('tb-cinta'))return cinta;
  cinta=document.createElement('div');
  cinta.className='cs-bar tb-cinta';cinta.hidden=true;cinta.setAttribute('role','toolbar');
  cinta.setAttribute('aria-label','Diseño de tabla');
  const boton=`<button type="button" class="btn sm cs-dis tb-dis" data-tba="cinta" aria-pressed="false" `
    +`title="Mostrar u ocultar las opciones de diseño y de ancho de las columnas">${ico('sheet',15)}<span>Diseño</span></button>`;
  const mk=()=>{const d=document.createElement('div');d.innerHTML=boton;return d.firstElementChild;};
  const cab=wrap.parentElement&&wrap.parentElement.querySelector(':scope > .panel-head,:scope > .mh');
  if(cab&&!cab.querySelector('.tb-dis')){
    /* En los modales el ultimo boton ya es el de cerrar: el de diseño entra antes para no quedar aislado. */
    const ancla=cab.classList.contains('mh')?cab.querySelector('button'):null;
    if(ancla)ancla.insertAdjacentElement('beforebegin',mk());else cab.insertAdjacentElement('beforeend',mk());
  }
  else if(!cab){const mini=document.createElement('div');mini.className='tb-mini-bar';mini.appendChild(mk());wrap.before(mini);}
  wrap.before(cinta);
  return cinta;
}
function tbDueña(nodo){
  const cinta=nodo.closest('.tb-cinta');
  if(cinta){const sig=cinta.nextElementSibling;return sig&&sig.querySelector?sig.querySelector('table.tb'):null;}
  const cab=nodo.closest('.tb-mini-bar,.panel-head,.mh');
  if(!cab)return null;
  /* Primero el hermano que sigue al encabezado (la carpeta con la tabla); si alli no hay,
     se busca dentro del panel, donde solo puede haber una. */
  const sig=cab.nextElementSibling, dentro=sig&&sig.querySelector?sig.querySelector('table.tb'):null;
  if(dentro)return dentro;
  const cont=cab.parentElement;
  return cont?cont.querySelector('table.tb'):null;
}
function tbPintaBarra(t){
  const cinta=tbBarra(t);if(!cinta)return;
  const clave=t.dataset.tb,C=tbCfg(clave),pop=TB.popT===clave?TB.pop:'';
  /* La cinta solo se re-escribe cuando cambia lo que muestra: su tabla y su diseno efectivo (que ya
     incluye lo heredado, porque tbCfg lo resuelve al leer). Antes llevaba ademas la version del
     guardado, asi que tocar una tabla re-escribia TODAS las cintas del panel y ese era el segundo
     parpadeo. */
  const hash=[clave,C.estilo,C.dens,C.letra,C.cinta?1:0,pop,Object.keys(C.op).map(k=>C.op[k]?1:0).join('')].join('|');
  if(cinta.dataset.hash===hash)return;
  cinta.dataset.hash=hash;
  const btn=(k,ic,txt,popHtml,right)=>`<div class="cs-wrap"><button type="button" class="cs-btn ${pop===k?'on':''}" `
    +`data-tba="pop" data-v="${k}" aria-expanded="${pop===k}" aria-haspopup="true">${ico(ic,22)}`
    +`<span>${txt}<i>${ico('chev',10)}</i></span></button>${pop===k?`<div class="cs-pop ${right?'r':''}" role="dialog" aria-label="${txt}">${popHtml}</div>`:''}</div>`;
  const galeria=`<h5>Estilos de esta tabla</h5><div class="cs-grid g4">${TB_ESTILOS.map(e=>
    `<button type="button" class="cs-sty ${C.estilo===e.k?'on':''}" data-tba="est" data-v="${e.k}" title="${esc(e.n)}">${tbMini(e)}<span>${esc(e.n)}</span></button>`).join('')}</div>`;
  const opciones=`<h5>Opciones de esta tabla</h5>${TB_OPS.map(([k,n])=>
    `<label class="cs-chk"><input type="checkbox" data-tba="op" data-v="${k}" ${C.op[k]?'checked':''}>${n}</label>`).join('')}`;
  const tamano=`<h5>Tamaño de esta tabla</h5><div class="cs-field"><span>Altura del renglón</span><div class="seg" role="group" aria-label="Densidad">${
    TB_DENS.map(([k,n])=>`<button type="button" data-tba="dens" data-v="${k}" aria-pressed="${C.dens===k}">${n}</button>`).join('')}</div></div>`
    +`<div class="cs-field"><span>Letra</span><select data-tba="letra">${[10,11,12,13].map(v=>
      `<option value="${v}" ${C.letra===v?'selected':''}>${v} px</option>`).join('')}</select></div>`;
  const columnas=`<h5>Columnas de esta tabla</h5>`
    +`<button type="button" class="cs-item" data-tba="fit" data-v="todas">${ico('refresh',20)}<span><b>Ajustar todas al contenido</b><small>Cada columna toma el ancho de su texto más largo, como en Excel.</small></span></button>`
    +`<button type="button" class="cs-item" data-tba="fit" data-v="una">${ico('sheet',20)}<span><b>Ajustar una columna</b><small>Doble clic en el borde derecho de su encabezado.</small></span></button>`
    +`<button type="button" class="cs-item" data-tba="clear">${ico('x',20)}<span><b>Quitar los anchos de esta tabla</b><small>Vuelve al ancho que reparte el navegador.</small></span></button>`;
  cinta.innerHTML=btn('estilo','sheet','Estilos',galeria)+btn('ops','plusc','Opciones',opciones)
    +btn('tam','layers','Tamaño',tamano)+'<span class="cs-sep"></span>'+btn('col','db','Columnas',columnas,true)
    +`<button type="button" class="cs-btn" data-tba="todas" title="Copiar el diseño de esta tabla a todas las tablas del panel">${ico('copy',22)}<span>Igualar todas</span></button>`;
  cinta.hidden=!C.cinta;
  /* El boton de diseno es de esta tabla: los demas paneles conservan su propio estado abierto/cerrado. */
  const mini=cinta.previousElementSibling;
  const b=(mini&&mini.querySelector?mini.querySelector('.tb-dis'):null)
    ||(cinta.parentElement?cinta.parentElement.querySelector(':scope > .panel-head .tb-dis,:scope > .mh .tb-dis'):null);
  if(b)b.setAttribute('aria-pressed',C.cinta?'true':'false');
}
function tbAnchosAplica(t){
  const guardados=TB.anchos[t.dataset.tb]||{},cols=tbCols(t);
  cols.forEach((c,i)=>{
    const w=guardados[i]?guardados[i]+'px':'';
    if(c.style.width!==w)c.style.width=w;
  });
  t.classList.toggle('tb-con-ancho',Object.keys(guardados).length>0);
}
function tbAplica(t){
  const n=tbColumnas(t);if(n<2)return;
  t.dataset.tb=tbClaveDe(t);
  const C=tbCfg(t.dataset.tb),cols=tbCols(t,n);
  t.classList.add('tb');
  TB_ESTILOS.forEach(e=>t.classList.remove('tb-est-'+e.k));
  TB_DENS.forEach(([k])=>t.classList.remove('tb-dens-'+k));
  ['tb-cab-fila','tb-sin-cab','tb-bandera','tb-bandas-col','tb-prim','tb-ult','tb-cruz'].forEach(c=>t.classList.remove(c));
  t.classList.add('tb-est-'+C.estilo,'tb-dens-'+C.dens);
  tbTintas(t);
  if(C.op.cabFila)t.classList.add('tb-cab-fila');
  if(!C.op.cabCol)t.classList.add('tb-sin-cab');
  if(C.op.bandF)t.classList.add('tb-bandera');
  if(C.op.bandC)t.classList.add('tb-bandas-col');
  if(C.op.prim)t.classList.add('tb-prim');
  if(C.op.ult)t.classList.add('tb-ult');
  if(C.op.res)t.classList.add('tb-cruz');
  t.style.setProperty('--tb-fs',C.letra+'px');
  cols.forEach((c,i)=>c.classList.toggle('tb-col-b',i%2===1));
  [...t.tHead.rows[0].cells].forEach((th,i)=>{
    let m=th.querySelector('.tb-mango');
    if(!m){m=document.createElement('button');m.type='button';m.className='tb-mango';th.appendChild(m);}
    m.dataset.i=i;
    m.setAttribute('aria-label','Ajustar el ancho de la columna '+(th.textContent.trim()||i+1));
  });
  tbAnchosAplica(t);
  tbPintaBarra(t);
}
/* Excel hace lo mismo: suelta el ajuste automatico, deja que el contenido mida y toma ese ancho.
   Con table-layout:auto el navegador ya reparte cada columna al máximo de su celda, asi que basta
   con leer el ancho del encabezado. */
function tbMedir(t){
  const n=tbColumnas(t);if(!n)return[];
  const wrap=t.closest('.scroll')||t.parentElement;
  const cols=tbCols(t,n);
  const antes={layout:t.style.tableLayout,width:t.style.width,min:t.style.minWidth};
  t.classList.remove('tb-con-ancho');
  cols.forEach(c=>{if(c.style.width)c.style.width='';});
  t.style.tableLayout='auto';t.style.width='auto';t.style.minWidth=Math.max(320,(wrap&&wrap.clientWidth)||600)+'px';
  void t.offsetWidth;
  const ans=[...t.tHead.rows[0].cells].map(c=>Math.round(c.getBoundingClientRect().width));
  t.style.tableLayout=antes.layout;t.style.width=antes.width;t.style.minWidth=antes.min;
  return ans.map(w=>Math.max(TB_MIN,Math.min(TB_MAX,w)));
}
function tbAjustar(t,idx){
  const med=tbMedir(t);if(!med.length)return;
  const guard=TB.anchos[t.dataset.tb]||{};
  med.forEach((w,i)=>{if(idx===undefined||i===idx)guard[i]=w;});
  TB.anchos[t.dataset.tb]=guard;tbGuardar();
  tbAnchosAplica(t);
}
function tbAnchosQuitar(t){
  delete TB.anchos[t.dataset.tb];tbGuardar();tbAnchosAplica(t);
}
function tbPrepara(){
  document.querySelectorAll('table').forEach(t=>{
    if(t.closest('#repBody')||t.closest('.mail')||t.closest('.cs-pop')||t.closest('.tb-mini-bar'))return;
    if(!t.tHead||!t.tHead.rows.length)return;
    if(tbColumnas(t)<2)return;
    tbAplica(t);
  });
}

/* ---------- arrastrar el borde ---------- */
let tbRz=null;
document.addEventListener('pointerdown',e=>{
  const m=e.target.closest('.tb-mango');if(!m)return;
  const t=m.closest('table'),i=+m.dataset.i;
  const col=tbCols(t)[i];
  if(!col.style.width)tbAjustar(t,i);          /* al primer arrastre la columna se pone en su ancho de contenido */
  const cs=tbCols(t);
  const w0=parseFloat(cs[i].style.width)||Math.round(m.parentElement.getBoundingClientRect().width);
  tbRz={t,i,x0:e.clientX,w0,w:w0,col:cs[i],m};
  cs[i].style.width=w0+'px';t.classList.add('tb-con-ancho');
  m.classList.add('on');document.body.classList.add('tb-arrastrando');
  if(m.setPointerCapture)m.setPointerCapture(e.pointerId);
  e.preventDefault();e.stopPropagation();      /* que el clic en el borde no ordene la tabla */
},true);
document.addEventListener('pointermove',e=>{
  if(!tbRz)return;
  tbRz.w=Math.max(TB_MIN,Math.min(TB_MAX,Math.round(tbRz.w0+(e.clientX-tbRz.x0))));
  tbRz.col.style.width=tbRz.w+'px';
});
function tbSuelta(){
  if(!tbRz)return;
  const {t,i,w}=tbRz;
  if(w){(TB.anchos[t.dataset.tb]=TB.anchos[t.dataset.tb]||{})[i]=w;tbGuardar();}
  if(tbRz.m)tbRz.m.classList.remove('on');
  document.body.classList.remove('tb-arrastrando');
  tbRz=null;
  document.querySelectorAll('.tb').forEach(x=>tbAnchosAplica(x));
}
document.addEventListener('pointerup',tbSuelta);
document.addEventListener('pointercancel',tbSuelta);
document.addEventListener('dblclick',e=>{
  const m=e.target.closest('.tb-mango');if(!m)return;
  e.preventDefault();e.stopPropagation();
  tbAjustar(m.closest('table'),+m.dataset.i);
},true);

/* ---------- la cinta ---------- */
function tbRepinta(){document.querySelectorAll('.tb').forEach(x=>tbPintaBarra(x));}
document.addEventListener('click',e=>{
  const m=e.target.closest('.tb-mango');
  if(m){e.preventDefault();e.stopPropagation();return;}
  const b=e.target.closest('[data-tba]');
  if(!b)return;
  e.stopPropagation();
  const act=b.dataset.tba,v=b.dataset.v;
  /* Todo lo que se toca aqui es de UNA tabla: se resuelve su duena y solo ella se repinta. */
  const t=tbDueña(b),clave=t?t.dataset.tb:'';
  if(act==='cinta'){if(!t)return;tbSet(clave,{cinta:!tbCfg(clave).cinta});tbGuardar();tbRepinta();return;}
  if(act==='pop'){if(!t)return;
    if(TB.popT===clave&&TB.pop===v){TB.pop='';TB.popT='';}else{TB.pop=v;TB.popT=clave;}
    tbRepinta();return;}
  if(act==='est'){tbSet(clave,{estilo:v});tbGuardar();if(t)tbAplica(t);tbRepinta();return;}
  if(act==='op'){const o={};o[v]=b.checked;tbSet(clave,{op:o});tbGuardar();if(t)tbAplica(t);tbRepinta();return;}
  if(act==='dens'){tbSet(clave,{dens:v});tbGuardar();if(t)tbAplica(t);tbRepinta();return;}
  if(act==='todas'){if(!t)return;const C=tbCfg(clave);
    TB.def={estilo:C.estilo,dens:C.dens,letra:C.letra,op:C.op};
    TB.tablas={};tbSet(clave,{cinta:true});tbGuardar();
    document.querySelectorAll('.tb').forEach(x=>tbAplica(x));
    toast('El diseño de esta tabla se copió a todas las tablas',2800);return;}
  if(act==='fit'){if(t&&v!=='una')tbAjustar(t);
    else if(v==='una')toast('Arrastre el borde derecho del encabezado; con doble clic en ese borde la columna se ajusta sola.');return;}
  if(act==='clear'){if(t)tbAnchosQuitar(t);return;}
},true);
document.addEventListener('change',e=>{
  const s=e.target.closest&&e.target.closest('select[data-tba="letra"]');
  if(!s)return;
  const t=tbDueña(s);if(!t)return;
  tbSet(t.dataset.tb,{letra:+s.value});tbGuardar();tbAplica(t);tbRepinta();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&TB.pop){TB.pop='';TB.popT='';tbRepinta();}});
document.addEventListener('pointerdown',e=>{
  if(TB.pop&&!e.target.closest('.cs-pop')&&!e.target.closest('.cs-btn')){TB.pop='';TB.popT='';tbRepinta();}
});

/* ---------- cruz de Excel al pasar el raton ---------- */
document.addEventListener('mouseover',e=>{
  const td=e.target.closest('.tb-cruz tbody td');
  const t=td&&td.closest('table');if(!t)return;
  t.querySelectorAll('.tb-fila').forEach(r=>r.classList.remove('tb-fila'));
  t.querySelectorAll('.tb-cel').forEach(c=>c.classList.remove('tb-cel'));
  t.querySelectorAll('col.tb-col-on').forEach(c=>c.classList.remove('tb-col-on'));
  const i=[...td.parentElement.children].indexOf(td);
  td.classList.add('tb-cel');td.parentElement.classList.add('tb-fila');
  const col=tbCols(t)[i];if(col)col.classList.add('tb-col-on');
});

/* ---------- enganche ---------- */
{
  /* SE APLICA EN EL MISMO CUADRO, sin temporizador. Antes la pasada esperaba 140 ms, así que al marcar
     Descartada, cambiar de modulo o abrir una ventana, la tabla nueva se pintaba primero DESNUDA (sin
     clase .tb, sin franja de diseno, sin mangos y sin boton "Diseno") y 140 ms despues se vestia: eso era
     el parpadeo. El callback del MutationObserver corre como microtask al terminar la tarea que metio el
     HTML, o sea antes de que el navegador pinte: la tabla ya sale con su diseno.
     La pasada es idempotente (la cinta y el boton ya existen, los demas cambios son de atributos y aqui
     solo se miran los hijos), asi que re-dispararse una vez mas no hace nada y el bucle se corta solo.
     Se omite mientras se arrastra el borde de una columna: la pasada re-aplicaria los anchos guardados y
     cortaria el arrastre. */
  const obs=new MutationObserver(()=>{if(!tbRz)tbPrepara();});
  const arranca=()=>{tbPrepara();obs.observe(document.body,{childList:true,subtree:true});};
  if(document.body)arranca();else document.addEventListener('DOMContentLoaded',arranca);
}
