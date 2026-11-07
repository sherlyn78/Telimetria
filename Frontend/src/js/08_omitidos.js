/* 08_omitidos: eventos sin conductor o de un TAD oculto. Se abren en un modal desde el boton
   "Omitidos" de la barra de filtros, que solo aparece en el modulo No conductores.
   Cada fila tiene el boton de estatus (Descartada) y un campo de motivo; ambos se guardan en la base. */
const PASO_OM = 50;
let omVisibles = PASO_OM;
const omEstatus = r => OPC_ESTATUS.includes(r[6]) ? r[6] : '';
const omResumen = () => {
  const por = {};
  OMITIDOS.forEach(r => por[r[7]] = (por[r[7]] || 0) + 1);
  return Object.entries(por).map(([m, n]) => `${esc(m)}: ${n}`).join(' · ');
};
function sincronizarBotonOmitidos() {
  const b = $('#btnOmitidos'); if (!b) return;
  b.hidden = S.mod !== 'nocond' || !OMITIDOS.length;
  b.innerHTML = `${ico('tag', 15)} Omitidos (${OMITIDOS.length})`;
}
function pintarOmitidos() {
  const m = $('#modal'); if (!m) return;
  const filas = OMITIDOS.slice(0, omVisibles);
  m.classList.add('ancha');
  m.innerHTML = `<div class="mh"><div><h3>Eventos omitidos (${OMITIDOS.length})</h3><small>${omResumen()}</small></div>
    <button class="btn sm" data-act="closeAll" aria-label="Cerrar omitidos">${ico('x', 16)}</button></div>
    <div class="mb"><div class="scroll om-t"><table><thead><tr><th>Conductor</th><th>Núm. económico</th><th>TAD</th><th>Fecha</th><th>Hora</th><th>Tipo de evento</th><th>Omitido por</th><th>Estatus</th><th>Motivo</th></tr></thead><tbody>`
    + filas.map(r => {
      const e = omEstatus(r);
      return `<tr><td><b>${esc(r[4] || 'Sin conductor')}</b></td><td>${esc(r[3])}</td><td>${esc(r[2])}</td><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[5])}</td><td>${esc(r[7])}</td>
      <td><div class="est" role="group" aria-label="Estatus">${OPC_ESTATUS.map(o => `<button type="button" class="${o}" data-om="est" data-id="${esc(r[9])}" data-v="${o}" aria-pressed="${e === o}">${e === o ? 'Descartada' : 'Descartar'}</button>`).join('')}</div></td>
      <td><input class="i-mot" type="text" maxlength="500" data-om="motivo" data-id="${esc(r[9])}" value="${esc(r[10] || '')}" placeholder="Escribe el motivo…" aria-label="Motivo"></td></tr>`;
    }).join('')
    + `</tbody></table></div><div class="pager"><span>Mostrando ${filas.length} de ${OMITIDOS.length}</span>${omVisibles < OMITIDOS.length ? '<div class="b"><button class="btn sm" data-om="mas" type="button">Ver más</button></div>' : ''}</div></div>`;
}
function abrirOmitidos() {
  omVisibles = PASO_OM;
  pintarOmitidos();
  $('#modal').classList.add('on'); $('#overlay').classList.add('on');
  $('#modal').querySelector('button').focus();
}
const omBuscar = id => OMITIDOS.find(x => String(x[9]) === String(id));

document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-om]'); if (!b) return;
  if (b.dataset.om === 'mas') { omVisibles += PASO_OM; return pintarOmitidos(); }
  if (b.dataset.om !== 'est') return;
  const r = omBuscar(b.dataset.id); if (!r) return;
  const nuevo = omEstatus(r) === b.dataset.v ? '' : b.dataset.v;
  b.disabled = true;
  /* Se pinta el modal y, si el mismo evento tambien esta en No conductores, esa vista entera. */
  if (await guardarEvento(r[9], { estatus: nuevo })) sincronizarEstatus(r[9], nuevo || 'Sin estatus');
  pintarOmitidos();
  if (S.mod === 'nocond') sinAnimacionDeGraficas(renderMain);
  const nb = $(`#modal button[data-om="est"][data-id="${r[9]}"]`); if (nb) nb.focus();
});
document.addEventListener('change', async ev => {
  const i = ev.target.closest('input[data-om="motivo"]'); if (!i) return;
  const r = omBuscar(i.dataset.id); if (!r) return;
  if (await guardarEvento(r[9], { motivo: i.value })) { r[10] = i.value.trim(); i.classList.add('guardado'); setTimeout(() => i.classList.remove('guardado'), 1200); }
  else i.value = r[10] || '';
});
