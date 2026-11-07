/* 07_app: filtros, navegacion, eventos y arranque */
let ULTIMA_FIRMA_TAD='';   /* con que TAD estaba la vista la ultima vez, para detectar el cambio */
function activeFilters(){
  const a=[], lista=(arr,f)=>{const t=arr.map(f);return t.length>3?t.slice(0,3).join(', ')+' +'+(t.length-3):t.join(', ');};
  if(S.tad.length&&S.mod!=='comparador') a.push(['tad','TAD: '+lista(S.tad,x=>x)]);
  if(S.anio.length) a.push(['anio','Año: '+lista(S.anio,x=>x)]);
  if(S.mes.length) a.push(['mes','Mes: '+lista([...S.mes].map(Number).sort((x,y)=>x-y),i=>MESES[i])]);
  if(S.dia.length) a.push(['dia','Día: '+lista([...S.dia].map(Number).sort((x,y)=>x-y),x=>x)]);
  if(S.hora.length) a.push(['hora','Hora: '+lista([...S.hora].map(Number).sort((x,y)=>x-y),h=>String(h).padStart(2,'0')+':00')]);
  if(S.tipo.length) a.push(['tipo','Tipo: '+lista(S.tipo,x=>x)]);
  if(S.est.length) a.push(['est','Estatus: '+lista(S.est,x=>x)]);
  if(S.asig.length) a.push(['asig','Asignación: '+lista(S.asig,x=>x)]);
  return a;
}
function syncFilters(){
  S.tipo=S.tipo.filter(t=>tiposDelMod().includes(t));
  if(S.mod!=='nocond') S.asig=[];   /* el filtro por asignacion solo existe en No conductores */
  msRenderAll();
  $('#chips').innerHTML=activeFilters().map(([k,t])=>`<span class="chip">${esc(t)}<button data-act="chipx" data-k="${k}" aria-label="Quitar filtro ${esc(t)}">${ico('x',12)}</button></span>`).join('');
}
/* La barra de filtros se pliega desde el boton de la fila de los chips; se recuerda en este navegador. */
function plegarFiltros(plegar){
  const f=$('#filters'), b=$('#btnFiltros'); if(!f||!b) return;
  const p=plegar===undefined?!f.classList.contains('fold'):plegar;
  f.classList.toggle('fold',p);
  b.setAttribute('aria-expanded',String(!p));
  b.innerHTML=ico('up',14)+`<span>${p?'Mostrar':'Ocultar'} filtros</span>`;
  try{localStorage.setItem('pemex_filtros_fold',p?'1':'0');}catch(e){}
}
function renderNav(){
  $('#nav').innerHTML=Object.entries(MODS).map(([k,m])=>`<button data-act="nav" data-m="${k}" ${k===S.mod?'aria-current="page"':''}>${ico(m.icon)}<span>${m.title}</span></button>`).join('');
}
function renderMain(){
  drawers=[]; studios=[];
  destruirGraficas();
  const m=$('#main');
  m.innerHTML=S.mod==='general'?viewGeneral():S.mod==='comparador'?viewComparador():S.mod==='nocond'?viewNocond():viewModule();
  drawers.forEach(f=>f());
  studios.forEach(f=>f());
  msRenderAll();
  renderDetail();
  sincronizarBotonOmitidos();
  prsRefresca();   /* la ventana de protocolos sigue la lista que se acaba de filtrar (10_resumen_protocolo) */
}
function refresh(){
  const firma=S.tad.slice().sort().join('|');
  if(firma!==ULTIMA_FIRMA_TAD&&S.tad.length<=2) SUGIERE_MES=S.tad.length>0;
  ULTIMA_FIRMA_TAD=firma;
  syncFilters();renderMain();
  SUGIERE_MES=false;
}
function pintarRuta(){
  const nombre=S.mod==='general'?'Seguridad TAD':MODS[S.mod].title;
  const b=$('#crumbMod'); if(b) b.textContent=nombre;
  document.title='ALERTAS · '+nombre;
}
function go(mod){
  S.mod=mod;S.q='';S.page=1;S.sort={k:'valor',d:-1};msOpen=null;
  location.hash=mod;pintarRuta();renderNav();closeAll();refresh();scrollTo({top:0});
}
function toast(msg,ms){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),ms||2600);}

/* ---------- modo oscuro ----------
   El circulo TAD de la esquina alterna el tema de TODA la pantalla. La eleccion se recuerda en
   este navegador (localStorage 'pemex_tema') y tambien la aplica el <script> del <head> del
   template antes del primer pintado, para que no destelle en claro al abrir.
   El reporte y el correo NO siguen el tema: su HTML va inline y sale siempre en claro, que es
   como lo soporta Word/Outlook. Al cambiar se repinta la vista: las tablas recalculan sus
   tintas (tbTintas mide el fondo que resuelva el nuevo tema) y las graficas de canvas toman
   su variante oscura (03_graficas.js, dibujar). */
function temaOscuro(){return document.documentElement.dataset.tema==='oscuro';}
function syncBotonTema(){
  const b=$('#topAv'); if(!b) return;
  const osc=temaOscuro();
  b.setAttribute('aria-pressed',String(osc));
  b.title=osc?'Cambiar a modo claro':'Cambiar a modo oscuro';
}
function aplicarTema(oscuro){
  const raiz=document.documentElement;
  if(oscuro) raiz.dataset.tema='oscuro'; else delete raiz.dataset.tema;
  try{localStorage.setItem('pemex_tema',oscuro?'oscuro':'claro');}catch(e){}
  syncBotonTema();
}
function cambiarTema(){
  aplicarTema(!temaOscuro());
  sinAnimacionDeGraficas(refresh);   /* repinta tablas con tintas nuevas y graficas con su variante oscura */
  toast(temaOscuro()?'Modo oscuro activado':'Modo claro activado');
}

/* El correo web (Outlook en el navegador) no puede adjuntar Excel y el enlace de Azure AD RECHAZA las
   direcciones muy largas ("AADSTS90015: Requested query string is too long"): antes viajaba el reporte
   completo en el cuerpo y la pagina de login decia "tenemos problemas para iniciar su sesion" sin abrir
   ningun borrador. El cuerpo va recortado a ~1000 caracteres codificados, cortando en fin de linea. */
let ULTIMO_COPIADO=false, ULTIMOS_DESTINATARIOS='';
function abrirCorreoWeb(){
  const t=$('#mailTo');
  const to=mailLista(((t?t.value:'')||ULTIMOS_DESTINATARIOS)||'');
  /* La copia solo viaja en el enlace si cabe: el deeplink de Azure AD rechaza consultas largas y no
     abre ningun borrador (AADSTS90015). Con 16 direcciones ya no cabe, y es preferible abrir el
     mensaje con el Para y el cuerpo, y decirle a la persona que ponga la copia a mano. */
  const cc=mailLista((($('#mailCC')?$('#mailCC').value:'')||MAIL_DEF.cc)||'');
  const llevaCc=!!cc&&encodeURIComponent(cc).length<=200;
  if(cc&&!llevaCc) toast('La copia (CC) es larga para el enlace del correo web: escribala a mano en el mensaje',7000);
  const R=REPORTE.texto?REPORTE:construirReporte();
  const q=encodeURIComponent, asunto='Reporte '+NOMBRE_REPORTE;
  const max=1000; let cuerpo=String(R.texto||''), recorte=false, vuelta=0;
  while(encodeURIComponent(cuerpo).length>max && cuerpo.length>60 && vuelta++<40){
    cuerpo=cuerpo.slice(0,Math.max(60,Math.floor(cuerpo.length*max/(encodeURIComponent(cuerpo).length+1))));
    recorte=true;
  }
  if(recorte){ const i=cuerpo.lastIndexOf('\n'); cuerpo=(i>120?cuerpo.slice(0,i):cuerpo)
    +(ULTIMO_COPIADO?'\n\nEl resto del reporte esta copiado: peguelo aqui con Ctrl+V.'
                   :'\n\nEl detalle no cabe en el enlace: use "Copiar con diseno" y peguelo aqui con Ctrl+V.'); }
  closeAll();
  window.open(`https://outlook.office.com/mail/deeplink/compose?to=${q(to)}${llevaCc?`&cc=${q(cc)}`:''}&subject=${q(asunto)}&body=${encodeURIComponent(cuerpo)}`,'_blank','noopener');
}
/* El motivo por el que Outlook no abrio se queda ESCRITO en el modal, con el boton del correo web al lado:
   el aviso flotante dura 2 segundos y el navegador suele bloquear la ventana que se abre sin un clic. */
function avisoCorreo(motivo,pasos){
  const d=$('#mailAviso');
  if(!d){toast(motivo+(pasos?' (vea el recuadro del modal)':''),14000);abrirCorreoWeb();return;}
  const guia=ULTIMO_COPIADO
    ? 'El reporte ya esta copiado: peguelo en el mensaje con <b>Ctrl+V</b> para que salga con el diseño del panel, y arrastre el Excel desde su carpeta para adjuntarlo.'
    : 'Use el boton <b>Copiar con diseño</b>, peguelo en el mensaje con <b>Ctrl+V</b> y arrastre el Excel desde su carpeta para adjuntarlo.';
  d.innerHTML=`<b>${esc(motivo)}</b>${pasos?`<br>${pasos}`:''}<br>${guia}
    <div class="mail-aviso-botones"><button class="btn" data-act="closeAll">Cerrar</button>
    <button class="btn green" data-act="webmail">${ico('mail',16)} Abrir el correo web</button></div>`;
  d.classList.add('on');
}

document.addEventListener('click',e=>{
  const a=e.target.closest('[data-act]');
  if(a){
    const act=a.dataset.act;
    if(act==='nav') return go(a.dataset.m);
    if(act==='side') return $('#side').classList.toggle('on'),$('#overlay').classList.add('on');
    if(act==='closeAll') return closeAll();
    if(act==='clear'){S.tad=[];S.mes=[];S.dia=[];S.hora=[];S.tipo=[];S.est=[];S.anio=[];S.asig=[];S.page=1;return refresh();}
    if(act==='asigtodas'){S.asig=[];S.est=[];S.page=1;return refresh();}   /* "Todas" quita tambien el filtro de descartados de la cinta */
    if(act==='sodisc'){S.est=soloDescartados()?[]:['Descartada'];S.page=1;return refresh();}
    if(act==='filtros') return plegarFiltros();
    if(act==='chipx'){S[a.dataset.k]=[];S.page=1;return refresh();}
    if(act==='sort'){const k=a.dataset.k;S.sort=S.sort.k===k?{k,d:-S.sort.d}:{k,d:k==='valor'?-1:1};return renderDetail();}
    if(act==='page'){S.page+=+a.dataset.d;return renderDetail();}
    if(act==='export') return exportCSV();
    if(act==='omitidos') return abrirOmitidos();
    if(act==='mail') return openMail();
    if(act==='tema') return cambiarTema();   /* el circulo TAD de la esquina alterna claro/oscuro */
    if(act==='repzoom') return repZoom(a.dataset.k);          // solo cambia el tamano de la vista previa, nunca el correo
    if(act==='repwide') return repAncho();
    if(act==='verproto') return consultarProtocolo(+a.dataset.id);   // abre con Windows el archivo de la fila
    if(act==='webmail') return abrirCorreoWeb();   // clic del aviso: abre el correo web con accion de usuario real
    if(act==='maildef'){
      /* Guarda las dos listas en Backend\destinatarios.json: es lo que el modal trae solo de aqui en
         adelante, en cualquier laptop con esta memoria puesta. Se guarda lo que hay escrito en ese
         momento, no lo que estaba al abrir, para que corregir una lista sea escribir y guardar. */
      const para=mailLista(($('#mailTo')?$('#mailTo').value:'')||'');
      const cc=mailLista(($('#mailCC')?$('#mailCC').value:'')||'');
      fetch('/destinatarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({para,cc})})
        .then(r=>r.json().catch(()=>({ok:false,error:'el servidor no respondio'})))
        .then(j=>{
          if(!j.ok) return toast('No se guardo: '+(j.error||'el servidor no respondio'),9000);
          MAIL_DEF={para,cc};mailLocal();
          toast('Listo. Los proximos reportes salen con estos destinatarios y esa copia.');
        })
        .catch(()=>toast('Sin servidor local: abra el panel con ABRIR_DASHBOARD.bat para poder guardar la lista',9000));
      return;
    }
    if(act==='abrirentrada'){   // ensena la carpeta de los Excel: se arrastran al correo web cuando Outlook no abre
      fetch('/abrir-carpeta',{cache:'no-store'}).then(r=>r.json().catch(()=>({ok:false,error:'el servidor no respondio'})))
        .then(j=>toast(j.ok?'Carpeta abierta en el Explorador: arrastre el Excel a la ventana del correo'
                           :(j.error||'No se pudo abrir la carpeta en este equipo')))
        .catch(()=>toast('Sin servidor local: abra el panel con ABRIR_DASHBOARD.bat para ver la carpeta de Entrada'));
      return;
    }
    if(act==='copyrep'){
      const R=construirReporte(), el=$('#repBody');
      const ok=()=>toast('Reporte copiado. Pégalo en tu correo con Ctrl+V');
      const respaldo=()=>{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('copy');s.removeAllRanges();ok();};
      if(navigator.clipboard&&window.ClipboardItem){
        navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([el.outerHTML],{type:'text/html'}),'text/plain':new Blob([R.texto],{type:'text/plain'})})]).then(ok,respaldo);
      }else respaldo();
      return;
    }
    if(act==='sendmail'){
      /* Gmail y la app de correo ya no se ofrecen. Outlook de escritorio abre el mensaje con los Excel
         del periodo (los adjunta el servidor local); sin servidor o sin Outlook, queda el correo web. */
      const lista=mailLista($('#mailTo').value);
      const copia=mailLista(($('#mailCC')?$('#mailCC').value:'')||'');
      ULTIMOS_DESTINATARIOS=lista;   // por si el modal se cerro antes de responder
      const R=REPORTE.texto?REPORTE:construirReporte();
      const asunto='Reporte '+NOMBRE_REPORTE;
      /* La imagen del final NO viaja en base64 dentro del HTML del mensaje: el HTML que se manda al
         servidor lleva src="cid:..." y el servidor adjunta el archivo con ese Content-ID, que es como
         Outlook de escritorio incrusta una imagen y ademas la deja visible entre los adjuntos.
         (AISLA/REPORTE guardan el data: para la vista previa y para "Copiar con diseño".) */
      /* El correo web no puede adjuntar ni llevar el diseño: se copia el reporte con formato al portapapeles
         para que la persona lo pegue con Ctrl+V y no salga el mensaje en texto plano.
         Se copia AQUI, en el mismo clic, y NO dentro del .then() del fetch: el navegador solo deja escribir
         en el portapapeles mientras la accion del usuario esta vigente y al esperar la respuesta de Outlook
         (varios segundos) el permiso ya se perdio, por eso el correo salia en texto plano. */
      const el=$('#repBody');
      ULTIMO_COPIADO=false;
      if(el){
        const respaldo=()=>{try{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();
            s.removeAllRanges();s.addRange(r);document.execCommand('copy');s.removeAllRanges();ULTIMO_COPIADO=true;}catch(_){}};
        if(navigator.clipboard&&window.ClipboardItem){
          navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([el.outerHTML],{type:'text/html'}),
                                                        'text/plain':new Blob([R.texto],{type:'text/plain'})})])
            .then(()=>{ULTIMO_COPIADO=true;},respaldo);
        }else respaldo();
      }
      /* La casilla "Adjuntar el Excel" ya no decide si se usa Outlook: Outlook abre SIEMPRE con el diseno
         y con la imagen del final adjuntada; desmarcarla solo quita los Excel del periodo
         (2026-11-05, para que la imagen no dependa de los Excel). Sin servidor, avisoCorreo() da la
         salida al correo web. */
      const llevaExcel=!$('#mailAdj')||$('#mailAdj').checked;
      fetch('/correo',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({para:lista,cc:copia,asunto,texto:R.texto,html:repHtmlCorreo(R.html),
                             meses:llevaExcel?repClaves():[]})})
        .then(r=>r.json().catch(()=>({ok:false,error:'el servidor no respondio'})))
        .then(j=>{
          if(!j.ok){
            return avisoCorreo('Outlook de escritorio no abrio en este equipo: '+(j.error||'no respondio'));
          }
          closeAll();
          const n=(j.adjuntos||[]).length, av=[];
          if((j.sin_adj||[]).length) av.push('no se pudo adjuntar '+j.sin_adj.join(', '));
          if((j.faltan||[]).length) av.push('sin archivo de '+j.faltan.map(claveMes).join(', '));
          toast('Outlook abrio el mensaje con el diseño del reporte'
            +(llevaExcel?(n?' y '+n+' Excel adjuntado'+(n===1?'':'s'):' sin Excel'):' sin Excel (casilla desmarcada)')
            +(j.imagen?', con '+j.imagen+' al final y adjuntado':'')
            +(av.length?' · '+av.join(' · '):''));
        })
        .catch(e=>{
          /* Dos casos que antes se confundian: (a) la pagina se abrio con el servidor (http) y ADEMAS se le
             cayo la peticion -> el servidor esta vivo pero algo reviento aqui o en el servidor; (b) la copia
             abierta con doble clic (file:) -> alli si, no hay servidor. Decirle "abra el .bat" en (a) era
             mandarlo a cerrar y abrir ventanas que ya estaban bien. */
          const conServidor=/^https?:$/.test(location.protocol);
          const detalle=(e&&e.message?String(e.message):'').slice(0,140);
          return avisoCorreo(conServidor
              ? 'El servidor local si esta abierto, pero el intento de abrir Outlook se corto'+(detalle?': '+detalle:'')+
                '. Queda apuntado en Registros\\correo.log.'
              : 'Esta pagina no encuentra al servidor local, y sin el Outlook no puede adjuntar los Excel.',
            conServidor
              ? 'Recargue esta pagina con <b>F5</b> y vuelva a Correo. Si se vuelve a cortar, cierre la ventana negra del panel, de doble clic otra vez a <b>ABRIR_DASHBOARD.bat</b> (dejandola abierta) y revise el ultimo renglon de <b>Registros\\correo.log</b>: ahi esta el motivo.'
              : 'Paso 1: de <b>doble clic a ABRIR_DASHBOARD.bat</b> (esta en la raiz de la USB). &nbsp;Paso 2: <b>no cierre la ventana negra</b> que sale: ESA ventana es el servidor y hay que dejarla abierta mientras trabaje. &nbsp;Paso 3: regrese aqui y recargue con <b>F5</b>; el boton Correo ya va a adjuntar. &nbsp;Si esa ventana dice que no abrio ningun puerto, cierre las otras ventanas negras del panel que tenga abiertas y vuelva a dar doble clic.');
        });
      return;
    }
    /* Periodo del reporte: solo repinta la ventana del reporte, nunca el panel. */
    if(act==='rsvista'){RS.vista=a.dataset.v;rsPodar();return pintaReporte();}
    if(act==='rsmulti'){RS.multi=!RS.multi;if(!RS.multi&&rsSel().length>1)rsSet([rsSel()[rsSel().length-1]]);return pintaReporte();}
    if(act==='rstodos'){rsSet([]);return pintaReporte();}
    /* Fila de meses en modo "Por día": cambia el alcance del que salen los días, no la seleccion de días. */
    if(act==='rsscope'){
      const v=a.dataset.v;
      if(v==='') RS.mes=[];
      else{ const s=RS.mes.slice(), i=s.findIndex(x=>String(x)===v);
        if(RS.multi){if(i>=0)s.splice(i,1);else s.push(v);RS.mes=s.length===MES3.length?[]:s;}
        else RS.mes=i>=0?[]:[v]; }
      rsPodar();
      return pintaReporte();
    }
    if(act==='rschip'){
      const v=a.dataset.v, s=rsSel().slice(), i=s.findIndex(x=>String(x)===v);
      if(RS.multi){if(i>=0)s.splice(i,1);else s.push(v);rsSet(s.length===rsOpts().length?[]:s);}   /* todo marcado = sin filtro */
      else rsSet(i>=0?[]:[v]);
      return pintaReporte();
    }
  }
  if(e.target.closest('.est,.i-mot,.proto')) return;   // botones de estatus, campo de motivo y celda de protocolo: no abrir el boletin
  const bt=e.target.closest('[data-bol]');
  if(bt){BOL.tipo=BOL.tipo===bt.dataset.v?'':bt.dataset.v;pintaBoletin();
    const n=[...document.querySelectorAll('#drawer .bars-row[data-bol="tipo"]')].find(x=>x.dataset.v===bt.dataset.v);
    if(n) n.focus(); return;}
  const r=e.target.closest('[data-cond]'); if(r) return openBulletin(r.dataset.cond);
  const t=e.target.closest('[data-tadrow]'); if(t){S.tad=[t.dataset.tadrow];S.page=1;return refresh();}
  const ft=e.target.closest('[data-filtrotipo]'); if(ft) return alternar('tipo',ft.dataset.filtrotipo);
  const fa=e.target.closest('[data-filtroasig]'); if(fa) return alternar('asig',fa.dataset.filtroasig);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeAll();
  if(e.key==='Enter'&&e.target.matches&&e.target.matches('input,button')){ if(e.target.dataset.ev==='motivo') e.target.blur(); return; }
  if(e.key==='Enter'){const r=e.target.closest&&e.target.closest('tr[data-cond]'); if(r) openBulletin(r.dataset.cond);
    const ft=e.target.closest&&e.target.closest('[data-filtrotipo]'); if(ft) alternar('tipo',ft.dataset.filtrotipo);
    const fa=e.target.closest&&e.target.closest('[data-filtroasig]'); if(fa) alternar('asig',fa.dataset.filtroasig);}
});
document.addEventListener('input',e=>{
  if(e.target.id==='q'){S.q=e.target.value;S.page=1;renderDetail();}
});
document.addEventListener('change',e=>{
  if(e.target.dataset&&e.target.dataset.rs==='anio'){RS.anio=e.target.value;rsPodar();return pintaReporte();}
  if(e.target.dataset&&e.target.dataset.cmp){
    const c=e.target.dataset.cmp;
    /* MA/MB son los meses del comparador: se guardan como lista de uno para reusar inSel(). */
    S['cmp'+c]=(c==='MA'||c==='MB')?[+e.target.value]:e.target.value;
    renderMain();
  }
});
/* Estatus: un boton por evento que se guarda en la base; clic en el activo lo quita.
   Marcar o quitar "Descartada" cambia los numeros de toda la vista (KPIs, graficas, desglose,
   tabla y boletin), asi que se repinta todo; la pagina, el scroll y el foco del boton se conservan. */
function repintarEstatus(idEvento){
  const y=scrollY;
  sinAnimacionDeGraficas(()=>{
    renderMain();
    if($('#drawer').classList.contains('on')) pintaBoletin();
  });
  const b=$(`button[data-ev="est"][data-id="${idEvento}"]`);
  if(b&&document.activeElement!==b) b.focus();
  scrollTo(0,y);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('button[data-ev="est"]'); if (!b) return;
  const ev = POR_ID.get(+b.dataset.id); if (!ev) return;
  const viejo = ev.estatus, nuevo = viejo === b.dataset.v ? '' : b.dataset.v;
  sincronizarEstatus(ev.id, nuevo || 'Sin estatus');
  repintarEstatus(ev.id);
  if (await guardarEvento(ev.id, { estatus: nuevo })) return;
  sincronizarEstatus(ev.id, viejo);
  repintarEstatus(ev.id);
});


/* Motivo: se guarda al salir del campo o al pulsar Enter */
document.addEventListener('change',async e=>{
  const i=e.target.closest&&e.target.closest('input[data-ev="motivo"]'); if(!i) return;
  const ev=POR_ID.get(+i.dataset.id); if(!ev) return;
  if(await guardarEvento(ev.id,{motivo:i.value})){ev.motivo=i.value.trim();i.classList.add('guardado');setTimeout(()=>i.classList.remove('guardado'),1200);}
  else i.value=ev.motivo||'';
});
/* Protocolo: la casilla se guarda en cuanto se marca o se desmarca ('1' = si, vacio = no).
   No mueve graficas ni tablas, asi que se reescribe solo el numero de la tarjeta "Protocolos
   realizados": cambia al instante, sin recomponer la vista y sin perder el lugar en la tabla.
   Si la base la rechaza, vuelve el numero anterior. */
document.addEventListener('change',async e=>{
  const i=e.target.closest&&e.target.closest('input[data-ev="proto"]'); if(!i) return;
  const ev=POR_ID.get(+i.dataset.id); if(!ev) return;
  const pa=i.closest('.proto-pa'), rotulo=pa&&pa.querySelector('.proto-txt');
  const viejo=!!ev.protocolo; ev.protocolo=i.checked;
  if(rotulo) rotulo.textContent=i.checked?'Sí':'No';
  actualizarTarjetaProtocolo();
  if(await guardarEvento(ev.id,{protocolo:i.checked?'1':''})) return;
  ev.protocolo=viejo; i.checked=viejo;
  if(rotulo) rotulo.textContent=viejo?'Sí':'No';
  actualizarTarjetaProtocolo();
});
/* Subir: el archivo elegido se manda al servidor local, que lo escribe en la carpeta de Protocolo. */
document.addEventListener('change',e=>{
  const i=e.target.closest&&e.target.closest('input[data-ev="sub"]'); if(!i) return;
  const archivo=i.files&&i.files[0];
  i.value='';   // si al dia siguiente eligen el mismo archivo, el cambio vuelve a dispararse
  if(archivo) subirProtocolo(+i.dataset.id,archivo);
});
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>drawers.forEach(f=>f()),120);});


document.addEventListener('input', e => {
  const i = e.target.closest && e.target.closest('input[data-ev="motivo"], input[data-om="motivo"]');
  if (!i) return;
  
  // Convierte automáticamente la primera letra en mayúscula si hay texto
  if (i.value.length === 1) {
    i.value = i.value.toUpperCase();
  }
});

$('#userIc').innerHTML=ico('radio',17);
$('#menuIc').innerHTML=ico('menu',20);
$('#mailBtn').innerHTML=ico('mail',16)+'<span>Enviar reporte</span>';
syncBotonTema();   /* el <script> del head ya puso el tema guardado; aqui se sincroniza el boton */
{let p=null;try{p=localStorage.getItem('pemex_filtros_fold');}catch(e){} plegarFiltros(p===null?matchMedia('(max-width:900px)').matches:p==='1');}
$('#pie').textContent='Actualizado '+ACTUALIZADO+'  ·  lo que marque otra persona se ve al recargar la pagina (F5)';
/* Filtro de Estatus: se crea junto al de Tipo (copia su contenedor) si el template aun no lo trae */
(function(){
  if($('#f-est')) return;
  const ref=$('#f-tipo'); if(!ref) return;
  let w=ref; while(w.parentElement&&w.parentElement.querySelectorAll('.ms').length===1) w=w.parentElement;
  const c=w.cloneNode(true), m=c.id==='f-tipo'?c:c.querySelector('#f-tipo');
  m.id='f-est'; m.innerHTML='';
  const tw=document.createTreeWalker(c,NodeFilter.SHOW_TEXT);
  for(let n;(n=tw.nextNode());){ if(!m.contains(n)&&n.nodeValue.trim()){ n.nodeValue='Estatus'; break; } }
  w.after(c);
})();

{const h=location.hash.slice(1);S.mod=MODS[h]?h:'general';}
pintarRuta();
/* Abierto con doble clic (file://) el navegador no puede escribir la base de datos. Si el servidor
   local esta vivo, salta a el: ahi todo lo que se marque si se guarda. Si no, lo marcado queda
   apuntado en el equipo y el pie de pagina lo avisa.
   Se barren los 20 puertos que usa ABRIR_DASHBOARD.bat (8765..8784, los mismos de servidor.py): antes se
   probaba solo 8765 y, cuando ese lo tenia otra cosa, el panel decia "no hay servidor local" y el boton
   Correo no adjuntaba aunque el servidor estuviera vivo dos puertos mas alla. */
const TAD_PUERTOS=Array.from({length:20},(_,i)=>8765+i);
function buscarServidorTad(i){
  if(i>=TAD_PUERTOS.length) return Promise.reject(new Error('sin servidor'));
  /* Corto el intento a los 500 ms: si el puerto lo tiene un programa que acepta la conexion pero nunca
     contesta, la barrera no se queda colgado (los puertos libres fallan en milisegundos, asi que en lo
     normal esto ni se nota). */
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),500);
  return fetch('http://127.0.0.1:'+TAD_PUERTOS[i]+'/eventos',{mode:'no-cors',cache:'no-store',signal:ctl.signal})
    .then(()=>{clearTimeout(t);return TAD_PUERTOS[i];},
          ()=>{clearTimeout(t);return buscarServidorTad(i+1);});
}
if(location.protocol==='file:'){
  buscarServidorTad(0)
    .then(puerto=>{
      const p=localStorage.getItem(COLA);
      /* Se limpia antes de saltar: la direccion ya lleva los cambios a la version con servidor, y si
         no se borraran, la copia del archivo los volveria a reclamar cada vez que se abra. */
      if(p&&p!=='{}') localStorage.removeItem(COLA);
      location.replace('http://127.0.0.1:'+puerto+'/'+(p&&p!=='{}'?'?pend='+encodeURIComponent(p):'')+location.hash);
    })
    .catch(()=>{const n=Object.keys(leerCola()).length;
      $('#pie').textContent='Actualizado '+ACTUALIZADO+'  ·  abierto como archivo: no hay servidor. '+
        (n?n+' cambio(s) apuntado(s) en este navegador':'Lo que marques se apunta en este navegador')+
        ' (la copia del archivo no puede escribir en la base). Para guardarlo de verdad abra ABRIR_DASHBOARD.bat';});
}
/* Cambios que llegaron desde la copia del archivo: se pasan a la cola de este origen para que
   el arranque de abajo los envie a la base como uno mas. */
tomarPendientesDeLaUrl();
renderNav();
refresh(); // Carga de forma correcta toda la vista inicial
/* 1) El panel se alinea con la base de datos (y con lo apuntado en este equipo).
   2) Si quedaba algo sin escribir, se manda ahora y se avisa de cuanto sigue pendiente. */
cargarEstatus().then(cambio=>{
  if(cambio) sinAnimacionDeGraficas(refresh);
  const pendientes=Object.keys(leerCola()).length;
  if(!pendientes||!/^https?:$/.test(location.protocol)) return;
  enviarCola().then(quedan=>{
    toast(quedan?`Se escribieron ${pendientes-quedan} en la base; ${quedan} siguen pendientes`
                 :`${pendientes} cambio(s) anterior(es) guardado(s) en la base`);
    if(quedan!==pendientes) sinAnimacionDeGraficas(refresh);
  });
});

/* Sin refresco en segundos (decision del usuario, 2026-11-04): antes la vista preguntaba a /eventos
   cada 25 s y se repintaba sola cuando alguien mas habia marcado algo; eso es lo que hacia que la
   pantalla "se moviera" cada cierto tiempo. Lo que llego de otra laptop se ve ahora al recargar la
   pagina (F5) o al volver a abrir el panel, que es cuando `cargarEstatus()` del arranque alinea la
   vista con la base. Lo marcado en ESTE equipo no cambia: se escribe de inmediato y, si el servidor no
   estaba, la cola se manda en el arranque igual que antes. */