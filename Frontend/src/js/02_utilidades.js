/* 02_utilidades: estado, filtros y funciones de apoyo
   Los filtros (TAD, año, mes, día, hora, tipo, asignación) son LISTAS: vacía = todos; con valores = solo esos. */
const S={mod:'general',anio:[],tad:[],mes:[],dia:[],hora:[],tipo:[],est:[],asig:[],q:'',page:1,sort:{k:'valor',d:-1},
         cmpMode:'cond',cmpA:'',cmpB:'',cmpMA:[0],cmpMB:[Math.max(0,MES3.length-1)],cmpScope:[]};
let drawers=[], studios=[], cache={list:[],rows:[]};
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum=a=>a.reduce((x,y)=>x+y,0);
const fnum=x=>Number.isInteger(x)?String(x):x.toFixed(1);
/* Las duraciones vienen en minutos con decimales (0.2 min = 12 segundos). Como reloj se leen mejor. */
const fhora=x=>{if(x==null||isNaN(+x))return '—';const t=Math.round(+x*60),p=n=>String(n).padStart(2,'0');return `${p(Math.floor(t/3600))}:${p(Math.floor(t%3600/60))}:${p(t%60)}`;};
const fval=(M,x)=>M.unit==='min'?fhora(x):fnum(+x)+' '+M.unit;
/* Numero grande de una tarjeta KPI: la duracion ya sale en formato de reloj, lo demas conserva su unidad. */
const kpiVal=(M,x)=>M.unit==='min'?fhora(x):fnum(+x)+' <small style="font-size:15px;font-weight:600">'+M.unit+'</small>';
/* "TAD Alfa" ya trae la palabra TAD; "Alfa" no. Esto evita el "TAD TAD Alfa". */
const tadN=n=>/^tad\b/i.test(String(n))?String(n):'TAD '+n;
const inSel=(arr,v)=>!arr.length||arr.some(x=>String(x)===String(v));

function tiposDelMod(){
  const m=MODS[S.mod];
  /* No conductores tambien recibe los descartados de otros modulos, asi que su lista de tipos
     tiene que incluir los tipos de esos eventos; si no, el filtro no dejaria elegirlos. */
  if(m&&m.pool==='nocond'){
    const extra=EV_ALL.filter(e=>e.estatus==='Descartada'&&!e.no_conductor).map(e=>e.tipo_evento);
    return [...new Set([...TIPOS_NOCOND,...extra])].sort((a,b)=>a.localeCompare(b,'es'));
  }
  return (m&&m.types)||ALL_TIPOS;
}
function applyF(list,ignore=[]){
  return list.filter(e=>
    inSel(S.anio,e.anio)&&
    (ignore.includes('est')||inSel(S.est,e.estatus))&&
    (ignore.includes('tad')||inSel(S.tad,e.tad))&&
    (ignore.includes('mes')||inSel(S.mes,e.mes))&&
    inSel(S.dia,e.dia)&&
    inSel(S.hora,e.h)&&
    (ignore.includes('asig')||inSel(S.asig,e.conductor))&&
    (ignore.includes('tipo')||inSel(S.tipo,e.tipo_evento)));
}
function groupCount(list,key){const m=new Map();list.forEach(e=>m.set(e[key],(m.get(e[key])||0)+1));return m;}
/* Una Descartada deja de contar en gráficas y KPIs, tanto en su módulo como en General.
   Sigue apareciendo en la tabla y en el desglose para poder quitarle la marca, y si piden
   un estatus concreto en el filtro, ese manda (ahi si se cuenta lo que eligieron). */
const cuentan=l=>S.est.length?l:l.filter(e=>e.estatus!=='Descartada');
/* El boton "Descartados" de No conductores es un atajo del filtro de estatus: solo esta activo
   cuando lo unico marcado es Descartada. Si ademas eligieron otro estatus, manda el filtro. */
const soloDescartados=()=>S.est.length===1&&S.est[0]==='Descartada';
function initials(n){return n.split(' ').map(p=>p[0]).slice(0,2).join('');}

/* ---- Estatus: un solo boton (Descartada) y motivo editable; se guardan en la base por medio de servidor.py ---- */
const OPC_ESTATUS=['Descartada'];
const celdaEstatus=e=>`<div class="est" role="group" aria-label="Estatus">${OPC_ESTATUS.map(o=>`<button type="button" class="${o}" data-ev="est" data-id="${e.id}" data-v="${o}" aria-pressed="${e.estatus===o}">${e.estatus===o?'Descartada':'Descartar'}</button>`).join('')}</div>`;
const celdaMotivo=e=>`<input class="i-mot" type="text" maxlength="500" data-ev="motivo" data-id="${e.id}" value="${esc(e.motivo||'')}" placeholder="Escribe el motivo…" aria-label="Motivo">`;
/* Protocolo, en la misma fila del evento: casilla que se lee si/no, el boton para ELEGIR el documento
   de la carpeta de Protocolo (09_protocolo.js abre esa lista; desde ahi tambien se sube uno nuevo) y el
   boton para consultarlo con Windows. "Consultar" se queda habilitado si la base apunta a un archivo que
   no esta en este equipo, para que el aviso diga cual falta y no parezca que nunca se subio nada. */
const celdaProtocolo=e=>`<div class="proto" data-id="${e.id}">
  <label class="proto-pa" title="Palomeado = si, sin palomear = no"><input type="checkbox" data-ev="proto" data-id="${e.id}" ${e.protocolo?'checked':''} aria-label="Protocolo de este evento"><span class="proto-txt">${e.protocolo?'Sí':'No'}</span></label>
  <button type="button" class="proto-sub" data-act="listproto" data-id="${e.id}" title="Elegir el protocolo de la carpeta de Protocolo">Subir</button>
  <button type="button" class="proto-ver ${e.arch||e.arch_nom?'':'off'}" data-act="verproto" data-id="${e.id}" title="${e.arch?'Abrir el archivo guardado en la carpeta de Protocolo':(e.arch_nom?'Apunta a '+esc(e.arch_nom)+', pero ese archivo no esta en la carpeta de este equipo':'Este evento aun no tiene archivo')}">Consultar</button>
</div>`;
/* Si el evento ya tiene documento de protocolo. Se mira la base (arch_nom), no si el archivo se puede
   abrir desde esta laptop: sin la carpeta de Drive sincronizada la base sigue sabiendo que ya se subio. */
function archSubido(e){return !!(e&&(e.arch||e.arch_nom));}
/* Solo se repinta la celda de ese evento: la tabla, la pagina y el scroll se quedan donde estaban. */
function repintaProto(id){
  const e=POR_ID.get(+id), viejo=e&&document.querySelector(`div.proto[data-id="${id}"]`);
  if(viejo) viejo.outerHTML=celdaProtocolo(e);
}
/* Los de "Sin conductor" salen en la tabla de No conductores y ademas en el modal de omitidos:
   marcar uno actualiza las dos copias para que los descartados coincidan en todo el panel. */
function sincronizarEstatus(id,estatus){
  const e=POR_ID.get(+id); if(e) e.estatus=estatus;
  const o=OMITIDOS.find(x=>String(x[9])===String(id)); if(o) o[6]=estatus==='Sin estatus'?'':estatus;
}
/* Lo que no se pudo escribir en la base se apunta aqui (mismo navegador) y se reenvia solo
   al abrir con servidor: por eso el panel siempre dice como esta guardado lo que se ve. */
const COLA='pemex_estatus_pendientes_v1';
function leerCola(){try{const c=JSON.parse(localStorage.getItem(COLA)||'{}');return c&&typeof c==='object'?c:{};}catch(e){return {};}}
function escribirCola(c){try{localStorage.setItem(COLA,JSON.stringify(c));}catch(e){}}
function anotarPendiente(id,datos){const c=leerCola();c[id]=Object.assign({},c[id],datos);escribirCola(c);}
/* Lo apuntado sin servidor via a la version con servidor en la propia direccion ( "?pend=" ),
   porque el navegador no deja leer el almacen de otra direccion, ni siquiera la de file://. */
function tomarPendientesDeLaUrl(){
  let tra;
  try{tra=JSON.parse(new URLSearchParams(location.search).get('pend')||'null');}catch(e){return 0;}
  if(!tra||typeof tra!=='object') return 0;
  const c=leerCola();
  Object.keys(tra).slice(0,200).forEach(id=>{c[id]=Object.assign({},c[id],tra[id]);});
  escribirCola(c);
  history.replaceState(null,'',location.pathname+location.hash);
  return Object.keys(tra).length;
}
/* Se guarda campo por campo: un motivo pendiente no debe borrar un estatus que todavia no se manda. */
function quitarPendiente(id,datos){
  const c=leerCola(),p=c[id]; if(!p) return;
  Object.keys(datos).forEach(k=>{delete p[k];});
  if(!Object.keys(p).length) delete c[id];
  escribirCola(c);
}
/* Reenvia lo apuntado en el navegador. Devuelve la promesa con cuanto NO se pudo guardar. */
function enviarCola(){
  const c=leerCola(),ids=Object.keys(c); if(!ids.length) return Promise.resolve(0);
  return Promise.all(ids.map(id=>{
    const cuerpo={id:+id};
    if('estatus' in c[id]) cuerpo.estatus=c[id].estatus||'';
    if('motivo' in c[id]) cuerpo.motivo=c[id].motivo||'';
    if('protocolo' in c[id]) cuerpo.protocolo=c[id].protocolo?'1':'';
    return fetch('/evento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cuerpo)})
      .then(r=>r.json().catch(()=>({ok:false})))
      .then(j=>{if(j.ok) quitarPendiente(id,cuerpo);})
      .catch(()=>{});
  })).then(()=>Object.keys(leerCola()).length);
}
/* Devuelve 'base' (ya quedo en la base), 'local' (anotado en este equipo, todavia sin servidor)
   o false (la base lo rechazo: hay que revertir la pantalla). datos = {estatus:'Descartada'|''},
   {motivo:'texto'} y/o {protocolo:'1'|''} ('1' = palomeado = si) */
function guardarEvento(id,datos){
  anotarPendiente(id,datos);
  return fetch('/evento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({id:+id},datos))})
    .then(r=>r.json().catch(()=>({ok:false})).then(j=>{
      if(r.ok&&j.ok){quitarPendiente(id,datos);return 'base';}
      if(r.status>=500) throw Object.assign(new Error(j.error||'La base esta ocupada'),{reintentar:true});
      quitarPendiente(id,datos);
      throw new Error(j.error||'No se pudo guardar');
    }))
    .catch(err=>{
      /* TypeError = el servidor ya no esta (se cerro la ventana): el cambio queda apuntado y
         se reenviara al abrir de nuevo, en lugar de hacerse aparecer como un rechazo de la base. */
      if(err.reintentar||err instanceof TypeError||location.protocol==='file:'){
        toast(location.protocol==='file:'
          ?'Queda apuntado en este navegador (esta copia del archivo no puede escribir la base)'
          :err.message+', se intentara otra vez al abrir');
        return 'local';
      }
      toast(err.message||'No se pudo guardar');
      return false;
    });
}
/* El archivo viaja en base64 dentro de un JSON al servidor local, que es el unico que puede
   escribir en la carpeta de Protocolo. Sin servidor no hay forma de guardarlo: se avisa. */
const MAX_SUBIDA=20*1000*1000;
function subirProtocolo(id,archivo){
  const ev=POR_ID.get(+id); if(!ev||!archivo) return;
  if(archivo.size>MAX_SUBIDA){toast('Ese archivo pesa más de 20 MB; elija uno más chico');return;}
  if(location.protocol!=='http:'&&location.protocol!=='https:'){
    toast('Abra el panel con ABRIR_DASHBOARD.bat para poder subir el archivo a la carpeta de Protocolo');return;
  }
  const fr=new FileReader();
  fr.onerror=()=>toast('No se pudo leer el archivo');
  fr.onload=()=>{
    toast('Subiendo '+archivo.name+'…',1500);
    fetch('/protocolo',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:+id,nombre:archivo.name,data:String(fr.result||'').split(',')[1]||''})})
      .then(r=>r.json().catch(()=>({ok:false})).then(j=>({ok:r.ok&&j.ok,error:j.error||'el servidor no respondio',
                                                          archivo:j.archivo,carpeta:j.carpeta})))
      .then(x=>{
        if(!x.ok){toast(x.error);return;}
        const tenia=ev.arch; ev.arch=true; ev.arch_nom=x.archivo||ev.arch_nom||''; repintaProto(id);
        /* El archivo subido tambien cuenta en la tarjeta "Protocolos realizados": se actualiza el
           numero de "archivos subidos" sin necesidad de recargar la pagina. */
        actualizarTarjetaProtocolo();
        cerrarProtocolo();
        toast((tenia?'Archivo actualizado':'Guardado el archivo')+' en '+(x.carpeta||'la carpeta de Protocolo'));
      })
      .catch(()=>toast('No hay servidor local: abra el panel con ABRIR_DASHBOARD.bat para subir el archivo'));
  };
  fr.readAsDataURL(archivo);
}
/* "Consultar" pide al servidor que abra el archivo con Windows (el navegador no puede abrir programas).
   Si el evento apunta a un nombre que no esta en este equipo se pregunta igual: el servidor es el que
   sabe en que carpetas lo busco, y asi el aviso dice cual archivo falta en lugar de "no tiene archivo". */
function consultarProtocolo(id){
  const ev=POR_ID.get(+id); if(!ev) return;
  if(!ev.arch&&!ev.arch_nom) return toast('Este evento todavía no tiene archivo: pulse "Subir" y elija uno de la carpeta de Protocolo');
  fetch('/protocolo?id='+id,{cache:'no-store'}).then(r=>r.json().catch(()=>({ok:false})))
    .then(j=>{
      toast(j.ok?('Abriendo '+j.archivo+' ('+j.carpeta+')'):(j.error||'No se pudo abrir el archivo'));
      if(j.ok){ev.arch=true;ev.arch_nom=j.archivo||ev.arch_nom;repintaProto(id);}
      else if(ev.arch){ev.arch=false;repintaProto(id);}
    })
    .catch(()=>toast('No hay servidor local: abra el panel con ABRIR_DASHBOARD.bat para consultar el archivo'));
}
/* La foto de estatus que va dentro del HTML queda obsoleta en cuanto alguien quita una Descartada,
   porque el servidor solo devuelve lo que tiene algo. Se recorren TODOS los eventos: lo que la base no
   confirma vuelve a "Sin estatus". Con base=null (no hay servidor) no se toca lo que ya esta en pantalla. */
function mezclarEstatus(base,pend){
  let cambio=false;
  const par=(clave,estVacio,cur,curMot,poner,curProto,curArch,curNom)=>{
    const b=base?base.get(clave):null,p=pend[clave];
    const est=p&&'estatus' in p?(p.estatus||estVacio):base?(b&&b[0]||estVacio):cur;
    const mot=p&&'motivo' in p?(p.motivo||''):base?(b&&b[1]||''):curMot;
    /* La casilla: lo apuntado en este navegador gana a la foto del HTML; 'protocolo' es '1' o vacio. */
    const pro=p&&'protocolo' in p?b2b(p.protocolo):base?(b&&b[2]==='1'):curProto;
    /* El archivo existe o no segun la base (b[3]); si no hay servidor se deja lo que ya traia el HTML.
       b[4] es el nombre al que apunta el evento: sin el no se podria explicar un "no lo encuentro". */
    const arc=base?!!(b&&b[3]):curArch;
    const nom=base?(b&&b[4])||'':curNom;
    if(est!==cur||mot!==curMot||pro!==curProto||arc!==curArch||nom!==curNom){poner(est,mot,pro,arc,nom);cambio=true;}
  };
  const b2b=v=>v==='1'||v===true||v===1;
  POR_ID.forEach((e,id)=>par(String(id),'Sin estatus',e.estatus,e.motivo||'',
    (a,b,c,d,n)=>{e.estatus=a;e.motivo=b;e.protocolo=c;e.arch=d;e.arch_nom=n;},e.protocolo,e.arch,e.arch_nom||''));
  OMITIDOS.forEach(o=>par(String(o[9]),'',o[6],o[10]||'',(a,b)=>{o[6]=a;o[10]=b;},false,false,''));
  return cambio;
}
/* Al abrir, el panel se alinea con la base (y con lo apuntado en este navegador). */
function cargarEstatus(){
  const sinBase=()=>mezclarEstatus(null,leerCola());
  if(location.protocol!=='http:'&&location.protocol!=='https:') return Promise.resolve(sinBase());
  return fetch('/eventos').then(r=>r.ok?r.json():null).then(mapa=>mapa
    ?mezclarEstatus(new Map(Object.keys(mapa).map(k=>[k,mapa[k]])),leerCola())
    :sinBase());
}
