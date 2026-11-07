/* 09_protocolo: el boton "Subir" de la columna Protocolo abre la lista de lo que HAY en la carpeta de
   Protocolo (la del Drive, segun Backend\.env), que es donde el area guarda estos documentos. Se elige uno
   con un clic y el evento queda apuntando a ese archivo, sin copiarlo ni moverlo. Si el documento vive en
   otro lado, "Subir desde otra carpeta" sigue usando el selector de Windows de siempre y el servidor lo
   copia dentro de esa misma carpeta. Sin servidor no hay forma de leer la carpeta: se avisa como abrirlo. */
let PR = {id:0, carpeta:'', archivos:[], q:'', cargando:false, desde:''};

const prFiltrados = () => {
  const q = PR.q.trim().toLowerCase();
  return q ? PR.archivos.filter(a => a.n.toLowerCase().includes(q)) : PR.archivos;
};
const prPeso = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const prFecha = t => new Date(t * 1000).toLocaleDateString('es-MX', {day:'2-digit', month:'2-digit', year:'numeric'});

function prPinta(){
  const m = $('#modal'); if (!m) return;
  const l = prFiltrados();
  m.classList.add('ancha');
  m.innerHTML = `<div class="mh"><div><h3>Protocolo del evento ${PR.id}</h3>
      <small>${PR.cargando ? 'Leyendo la carpeta de Protocolo…'
        : (PR.archivos.length ? PR.archivos.length + ' archivo(s) en ' + esc(PR.carpeta) : esc(PR.carpeta))}</small></div>
    <button type="button" class="btn sm" data-pr="cerrar" aria-label="Cerrar">${ico('x', 16)}</button></div>
    <div class="mb">` +
    (PR.cargando ? '<p class="page-sub">Un momento…</p>' : `
      <input type="text" id="prq" placeholder="Buscar en la carpeta…" value="${esc(PR.q)}" aria-label="Buscar archivo de protocolo">
      ` + (l.length ? `<div class="pr-lista">` + l.map(a => `
        <button type="button" class="pr-item ${a.ev.length ? 'usada' : ''}" data-pr="el" data-n="${esc(a.n)}"
          title="${a.ev.length ? 'Ya lo tienen el/los evento(s) ' + a.ev.join(', ') + ' · clic para usarlo también en el ' + PR.id : 'Asignar este archivo al evento ' + PR.id}">
          <span class="pr-n">${esc(a.n)}</span>
          <span class="pr-d">${prPeso(a.s)} · ${prFecha(a.m)}</span>
          <span class="pr-e">${a.ev.length ? 'en uso (' + a.ev.length + ')' : 'sin asignar'}</span>
        </button>`).join('') + `</div>`
        : `<div class="card empty"><b>${PR.archivos.length ? 'Ningún archivo coincide con la búsqueda'
            : 'Está vacía la carpeta de Protocolo de este equipo'}</b>${esc(PR.carpeta)}<br>Guarde ahí el documento y vuelva a abrir
            esta lista, o use «Subir desde otra carpeta» para que el panel lo copie a esa carpeta.</div>`))
    + `</div>
    <div class="mf">
      <label class="proto-sub" title="El archivo se copia dentro de la carpeta de Protocolo"><span>Subir desde otra carpeta…</span><input type="file" class="i-proto" data-ev="sub" data-id="${PR.id}" aria-label="Subir archivo de protocolo desde otra carpeta"></label>
      <button type="button" class="btn sm" data-pr="carpeta">Abrir la carpeta</button>
      <button type="button" class="btn sm" data-pr="cerrar">Cerrar</button>
    </div>`;
}

function prAbre(id){
  const ev = POR_ID.get(+id); if (!ev) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:')
    return toast('Abra el panel con ABRIR_DASHBOARD.bat para poder leer la carpeta de Protocolo');
  /* "desde" recuerda si esta lista se abrio desde la ventana de protocolos, para regresar a ella al
     cerrar o elegir el archivo en vez de volver al panel. */
  PR = {id: +id, carpeta: '', archivos: [], q: '', cargando: true, desde: prsAbierto() ? 'prs' : ''};
  $('#modal').classList.add('on');
  $('#overlay').classList.add('on');
  prPinta();
  fetch('/protocolos', {cache: 'no-store'})
    .then(r => r.json().catch(() => ({ok: false, error: 'el servidor no respondio'})))
    .then(j => {
      PR.cargando = false;
      if (!j.ok) { PR.carpeta = j.error || 'no se pudo leer la carpeta'; return prPinta(); }
      PR.carpeta = j.carpeta; PR.archivos = j.archivos || [];
      prPinta();
      const c = $('#modal #prq'); if (c) c.focus();
    })
    .catch(() => { PR.cargando = false; PR.carpeta = 'no hay servidor local en este equipo'; prPinta(); });
}

/* Al elegir un archivo que ya esta en la carpeta, el servidor solo cambia a que evento apunta. */
function prElige(nombre, boton){
  const ev = POR_ID.get(PR.id); if (!ev) return;
  if (boton) boton.disabled = true;
  fetch('/protocolo', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({id: ev.id, elegir: nombre})})
    .then(r => r.json().catch(() => ({ok: false})).then(j => ({ok: !!j.ok, error: j.error || 'el servidor no respondio', archivo: j.archivo})))
    .then(x => {
      if (!x.ok) { toast(x.error); if (boton) boton.disabled = false; return; }
      ev.arch = true; ev.arch_nom = x.archivo || nombre;
      repintaProto(ev.id); actualizarTarjetaProtocolo();
      const desde = PR.desde;
      PR = {id: 0, carpeta: '', archivos: [], q: '', cargando: false, desde: ''};
      if (desde === 'prs') return prsVuelve();
      closeAll();
      toast('El evento ' + ev.id + ' ahora apunta a ' + (x.archivo || nombre));
    })
    .catch(() => { toast('No hay servidor local: abra el panel con ABRIR_DASHBOARD.bat'); if (boton) boton.disabled = false; });
}

/* Se llama desde subirProtocolo (02_utilidades) cuando el archivo nuevo ya quedo en la carpeta. */
function cerrarProtocolo(){
  if (!PR.id) return;
  const desde = PR.desde;
  PR = {id: 0, carpeta: '', archivos: [], q: '', cargando: false, desde: ''};
  if (desde === 'prs') return prsVuelve();
  closeAll();
}

document.addEventListener('click', e => {
  const ab = e.target.closest && e.target.closest('[data-act="listproto"]');
  if (ab) return prAbre(ab.dataset.id);
  const b = e.target.closest && e.target.closest('[data-pr]'); if (!b) return;
  if (b.dataset.pr === 'cerrar') return cerrarProtocolo();
  if (b.dataset.pr === 'carpeta') {
    fetch('/abrir-carpeta?q=protocolo', {cache: 'no-store'})
      .then(r => r.json().catch(() => ({ok: false, error: 'el servidor no respondio'})))
      .then(j => toast(j.ok ? 'Carpeta abierta en el Explorador: ' + j.carpeta : (j.error || 'No se pudo abrir la carpeta')))
      .catch(() => toast('Sin servidor local: abra el panel con ABRIR_DASHBOARD.bat'));
    return;
  }
  if (b.dataset.pr === 'el') prElige(b.dataset.n, b);
});
document.addEventListener('input', e => {
  if (!e.target || e.target.id !== 'prq') return;
  PR.q = e.target.value;
  prPinta();
  const c = $('#modal #prq');
  if (c) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
});
