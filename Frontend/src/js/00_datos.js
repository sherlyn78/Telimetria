/* 00_datos: lee los datos que inserta construir_dashboard.py en <script id="datos">.
   Las filas llegan compactas (listas de indices) y aqui se expanden a objetos. */
const DATOS = JSON.parse(document.getElementById('datos').textContent);
const MESES = DATOS.meses.map(m => m.largo);           // 'Octubre 2025'
const MES3 = DATOS.meses.map(m => m.corto);            // 'Oct'  (unico dentro de la ventana de 12 meses)
const TADS = DATOS.tads.slice();
const RANGO_LARGO = DATOS.rangoLargo, RANGO_CORTO = DATOS.rangoCorto, ACTUALIZADO = DATOS.actualizado;

const api = (function () {
  const D = DATOS, ev = D.filas.map(r => {
    const conductor = r[4] < 0 ? 'Sin conductor' : D.conductores[r[4]].nombre;
    const noCond = !!r[13];
    return {
      id: r[11], motivo: r[12] || '', fecha: r[0], hora: r[1], mes: r[2], anio: +r[0].slice(0, 4),
      dia: +r[0].slice(8, 10), h: +r[1].slice(0, 2),
      tad: D.tads[r[3]], conductor, no_conductor: noCond, clasif: r[14] || '',
      num_economico: D.unidades[r[5]], tipo_evento: D.tipos[r[6]],
      velocidad_max: r[7], duracion_min: r[8], estatus: D.estatus[r[9]], hora_fin: r[10] || '',
      protocolo: r[15] === 1, arch: r[16] === 1   // casilla si/no y si ya trae archivo de Protocolo
    };
  });
  return { getEventos: () => ev, getConductores: () => D.conductores };
})();
const EV_ALL = api.getEventos();
const EV = EV_ALL.filter(e => !e.no_conductor);
const EV_NOCOND = EV_ALL.filter(e => e.no_conductor);
const POR_ID = new Map(EV_ALL.map(e => [e.id, e]));
const COND = api.getConductores().filter(c => !c.nocond);
const NOMBRES = COND.map(c => c.nombre).sort((a, b) => a.localeCompare(b, 'es'));
const ANIOS = [...new Set(EV_ALL.map(e => e.anio))].sort();
const TIPOS_NOCOND = [...new Set(EV_NOCOND.map(e => e.tipo_evento))].sort((a, b) => a.localeCompare(b, 'es'));
const OMITIDOS = DATOS.omitidos || [];
