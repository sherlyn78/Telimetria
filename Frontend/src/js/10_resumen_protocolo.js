/* 10_resumen_protocolo: la tarjeta "Protocolos realizados" se puede seleccionar y abre una ventana que
   reparte los eventos que tienes a la vista (los mismos filtros del módulo, no todos los de la base) en
   cuatro grupos: los que hicieron ambas cosas (palomearon y ya subieron archivo), los que solo marcaron,
   los que subieron el archivo sin marcarlo y los que no han hecho ninguna de las dos. Cada fila trae la
   misma celda de Protocolo de las tablas, así que ahí mismo se marca, se elige el archivo de la carpeta
   o se consulta; al hacerlo cambian en el acto el número de la tarjeta y las cuentas de esta ventana. */
const PASO_PRS = 50;
const PRS_GRUPOS = [
  ['ambos', 'Marcado y subido', 'Palomeó el protocolo y ya tiene archivo en la carpeta'],
  ['marcado', 'Solo marcado', 'Palomeó el protocolo pero todavía no sube ningún archivo'],
  ['arch', 'Solo archivo', 'Subió el documento pero no ha palomeado la casilla'],
  ['nada', 'Sin protocolo', 'Ni lo marcó ni subió archivo'],
];
let PRS = {grupo: 'ambos', vis: PASO_PRS};

const prsGrupo = e => archSubido(e) ? (e.protocolo ? 'ambos' : 'arch') : (e.protocolo ? 'marcado' : 'nada');
const prsConteos = () => {
  const c = {ambos: 0, marcado: 0, arch: 0, nada: 0};
  LISTA_VISTA.forEach(e => c[prsGrupo(e)]++);
  return c;
};
const prsLista = () => LISTA_VISTA.filter(e => prsGrupo(e) === PRS.grupo)
  .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
const prsModulo = () => (S.mod === 'general' ? 'Reporte General' : ((MODS[S.mod] || {}).title || 'este módulo'));
const prsSubtitulo = () => {
  const c = prsConteos();
  return `${LISTA_VISTA.length} eventos a la vista en ${prsModulo()} · `
    + PRS_GRUPOS.map(([k, t]) => `${t}: ${c[k]}`).join(' · ');
};
/* Se reconoce por sus propios chips: si el modal fue reemplazado por otro (la lista de archivos de
   "Subir", el reporte, los omitidos) ya no hay [data-prs] y esta ventana deja de refrescarse.
   Va como declaracion de funcion, no como const: renderMain la llama desde el arranque del panel,
   cuando el resto de este archivo todavia no se ejecuto, y una const ahi revienta el arranque. */
function prsAbierto() {
  const m = $('#modal');
  return !!m && m.classList.contains('on') && !!m.querySelector('[data-prs]');
}

function prsCuerpo() {
  const l = prsLista(), vis = l.slice(0, PRS.vis);
  return `<div class="mb"><div class="scroll prs-t"><table><thead><tr><th>Fecha</th><th>Hora</th><th>TAD</th>
      <th>Conductor</th><th>Unidad</th><th>Tipo de evento</th><th>Protocolo</th></tr></thead><tbody>`
    + (vis.length ? vis.map(e => `<tr><td>${esc(e.fecha)}</td><td>${esc(e.hora)}</td><td>${esc(e.tad)}</td>
        <td><b>${esc(e.conductor)}</b></td><td>${esc(e.num_economico)}</td>
        <td>${esc(e.tipo_evento)}${e.estatus === 'Descartada' ? ' <small class="prs-desc">Descartada</small>' : ''}</td>
        <td>${celdaProtocolo(e)}</td></tr>`).join('')
      : `<tr><td colspan="7" class="page-sub">Ninguno de los eventos que ves cae aquí: cambia de grupo arriba
          o afloja los filtros.</td></tr>`)
    + `</tbody></table></div><div class="pager"><span>Mostrando ${vis.length} de ${l.length}</span>${
        l.length > PRS.vis ? '<div class="b"><button class="btn sm" data-prs="mas" type="button">Ver más</button></div>' : ''
      }</div></div>`;
}

function prsPinta() {
  const m = $('#modal'); if (!m) return;
  const c = prsConteos();
  m.classList.add('ancha');
  m.innerHTML = `<div class="mh"><div><h3>Protocolos: quién subió y quién no</h3>
      <small>${esc(prsSubtitulo())}</small></div>
    <button type="button" class="btn sm" data-act="closeAll" aria-label="Cerrar">${ico('x', 16)}</button></div>
    <div class="prs-chips" role="group" aria-label="Grupos de protocolo">`
    + PRS_GRUPOS.map(([k, t, ay]) => `<button type="button" class="prs-chip${
        PRS.grupo === k ? ' on' : ''}" data-prs="${k}" title="${ay}" aria-pressed="${PRS.grupo === k}">${
        t} <b>${c[k]}</b></button>`).join('')
    + `</div>` + prsCuerpo();
}

function prsAbre() {
  const c = prsConteos();
  /* Al volver a abrir la tarjeta se conserva el grupo que se estaba viendo (si sigue teniendo eventos),
     para que quien cierra la ventana y la reabre no regrese siempre al principio de la lista. */
  const grupo = c[PRS.grupo] ? PRS.grupo : (PRS_GRUPOS.map(([k]) => k).find(k => c[k]) || 'ambos');
  PRS = {grupo, vis: PASO_PRS};
  $('#modal').classList.add('on');
  $('#overlay').classList.add('on');
  prsPinta();
  const b = $('#modal .prs-chips button'); if (b) b.focus();
}

/* Regreso desde la lista de archivos de "Subir" (09_protocolo.js): el modal sigue abierto, solo se
   vuelve a pintar esta ventana para que quien va revisando evento por evento no tenga que reabrir la
   tarjeta cada vez que elige o sube un documento. */
function prsVuelve() {
  const m = $('#modal'); if (!m) return;
  m.classList.add('on'); $('#overlay').classList.add('on');
  prsPinta();
  const b = $(`#modal [data-prs="${PRS.grupo}"]`); if (b) b.focus();
}

/* Lo que se mueve al marcar o subir algo con esta ventana abierta: las cuentas de los chips, el rótulo
   del título y, si el evento ya no pertenece al grupo que se mira, la lista. Se compone solo el cuerpo y
   se devuelve el scroll y el foco al mismo lugar, para que quien va palomeando uno por uno no pierda su
   fila en la pantalla. */
function prsRefresca() {
  if (!prsAbierto()) return;
  const m = $('#modal'), c = prsConteos();
  PRS_GRUPOS.forEach(([k]) => {
    const b = m.querySelector(`[data-prs="${k}"] b`);
    if (b && +b.textContent !== c[k]) b.textContent = c[k];
  });
  const sub = m.querySelector('.mh small'); if (sub) sub.textContent = prsSubtitulo();
  const viejo = m.querySelector('.mb'); if (!viejo) return;
  const sc = viejo.querySelector('.scroll'), tope = sc ? sc.scrollTop : 0;
  const activo = document.activeElement;
  const id = activo && activo.dataset ? activo.dataset.id : '';
  const caja = document.createElement('div');
  caja.innerHTML = prsCuerpo();
  viejo.replaceWith(caja.firstElementChild);
  const ns = m.querySelector('.scroll'); if (ns) ns.scrollTop = tope;
  /* Si la fila palomeada acaba de cambiar de grupo ya no esta en la lista: el foco se devuelve al boton
     del grupo que se mira, para que quien va marcando con Espacio/Enter no se quede en la nada. */
  if (id) {
    const nb = m.querySelector(`.proto[data-id="${id}"] input[type="checkbox"]`);
    if (nb) nb.focus();
    else if (activo && m.contains(activo) === false) { const ch = m.querySelector(`[data-prs="${PRS.grupo}"]`); if (ch) ch.focus(); }
  }
}

document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('.kpi[data-kpi="prot"]')) return prsAbre();
  const b = e.target.closest && e.target.closest('[data-prs]'); if (!b) return;
  if (b.dataset.prs === 'mas') { PRS.vis += PASO_PRS; return prsPinta(); }
  PRS = {grupo: b.dataset.prs, vis: PASO_PRS};
  prsPinta();
  const nb = $(`#modal [data-prs="${PRS.grupo}"]`); if (nb) nb.focus();
});
/* La tarjeta es un div con role="button", así que el Enter/Espacio hay que atenderlos aquí. */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.target.closest && e.target.closest('.kpi[data-kpi="prot"]')) { e.preventDefault(); prsAbre(); }
});
