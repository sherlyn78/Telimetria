/* 01_config: iconos, tipos de evento y configuracion de modulos */
const IC={
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  gauge:'<path d="M12 14l4-4"/><path d="M3.3 18a10 10 0 1117.4 0"/>',
  timer:'<circle cx="12" cy="14" r="7"/><path d="M12 10v4l2 2M9 2h6"/>',
  alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  alertc:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  slash:'<circle cx="12" cy="12" r="9"/><path d="M6 18L18 6"/>',
  xc:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  pulse:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  compare:'<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5V14a3 3 0 003 3h6.5M18 15.5V10a3 3 0 00-3-3H8.5"/>',
  truck:'<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  down:'<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
  up:'<path d="M12 20V9M7 13l5-5 5 5M4 4h16"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8M10 17h4"/>',
  sigma:'<path d="M18 5H6l6 7-6 7h12"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  radio:'<circle cx="12" cy="12" r="2"/><path d="M7.5 7.5a6 6 0 000 9M16.5 7.5a6 6 0 010 9M4.5 4.5a10 10 0 000 15M19.5 4.5a10 10 0 010 15"/>',
  pin:'<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag:'<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  check:'<path d="M4 12.5l5 5L20 6.5"/>'
};
const ico=(n,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

const T={AV:'Alta velocidad',FR:'Frenado de pánico',FH:'Freno nivel alto',NE:'Manejo en neutral',RC:'RPM >2000 con pedal',RS:'RPM >2000 sin pedal',RF:'RPM >1400 con motor frío',R20:'Ralentí >20 min',RP:'Pemex - Ralentí >15 min'};
/* Tipos que el panel no muestra (ni en tablas, graficas ni KPIs). Siguen en la base y
   el generador ya los deja fuera; esta lista es el respaldo para que ningun boton los vuelva a sacar.
   Debe coincidir con OCULTAR_EN_PANEL de Backend\reglas_eventos.py. */
const OCULTOS=[T.RP,T.RF];
/* Mismo orden que los modulos del menu: Alta velocidad, Ralenti, Neutral, RPM, Frenado.
   Lo que no este en esta lista sale al final, nunca se pierde. */
const ORDEN_TIPOS=[T.AV,T.R20,T.NE,T.RC,T.RS,T.FR,T.FH];
const ALL_TIPOS=[...new Set([...ORDEN_TIPOS,...Object.values(T)])].filter(t=>!OCULTOS.includes(t));

/* Columnas de la tabla de detalle de cada modulo (se resuelven en COLS, de 04_vistas.js).
   General no usa esta tabla: muestra el resumen por TAD con todos los tipos. */
const MODS={
  general:{title:'General',icon:'grid'},
  alta:{title:'Alta velocidad',icon:'gauge',sub:'Eventos de exceso de velocidad por conductor y TAD.',types:[T.AV],metric:'velocidad_max',unit:'km/h',
    cTotal:'Total de eventos de alta velocidad',cMax:'Velocidad máxima (km/h)',cAvg:'Velocidad promedio (km/h)',col:'Velocidad',noun:'alta velocidad',
    cols:['conductor','unidad','tad','mes','dia','hora','vel','estatus','motivo']},
  ralenti:{title:'Ralentí',icon:'timer',sub:'Unidades en ralentí por más de 20 minutos.',types:[T.R20],metric:'duracion_min',unit:'min',line:true,
    cTotal:'Total de eventos de ralentí',cMax:'Mayor duración (HH:MM:SS)',cAvg:'Promedio de duración (HH:MM:SS)',col:'Duración (HH:MM:SS)',noun:'ralentí',
    cols:['conductor','unidad','tad','mes','dia','hora','tipo','dur','vel','estatus','motivo']},
  neutral:{title:'Neutral',icon:'slash',sub:'Manejo en neutral y velocidad alcanzada.',types:[T.NE],metric:'velocidad_max',unit:'km/h',
    cTotal:'Total de eventos en neutral',cMax:'Velocidad máxima (km/h)',cAvg:'Velocidad promedio (km/h)',col:'Velocidad',noun:'neutral',
    cols:['conductor','unidad','tad','mes','dia','hora','dur','vel','estatus','motivo']},
  rpm:{title:'RPM',icon:'pulse',sub:'RPM mayores a 2000 con y sin pedal del acelerador.',types:[T.RC,T.RS],metric:'duracion_min',unit:'min',pila:true,
    cTotal:'Total de eventos de RPM',cMax:'Mayor duración (HH:MM:SS)',cAvg:'Promedio de duración (HH:MM:SS)',col:'Duración (HH:MM:SS)',noun:'RPM',
    cols:['conductor','unidad','tad','mes','dia','hora','tipo','dur','vel','estatus','motivo']},
  frenado:{title:'Frenado',icon:'alertc',sub:'Frenados de pánico y frenos de nivel alto, con la velocidad al momento del evento.',types:[T.FR,T.FH],metric:'velocidad_max',unit:'km/h',
    cTotal:'Total de eventos de frenado',cMax:'Velocidad máxima (km/h)',cAvg:'Velocidad promedio (km/h)',col:'Velocidad',noun:'frenado',
    cols:['conductor','unidad','tad','mes','dia','hora','tipo','vel','estatus','motivo']},
  nocond:{title:'No conductores',icon:'tag',sub:'Eventos de CAPACITACIÓN, DISPONIBLE, talleres externos, técnicos ASE, TRASLADOS y sin conductor. No entran en General ni en los demás módulos. Aquí caen también los eventos marcados como Descartados en cualquier módulo, para revisarlos y desmarcarlos desde un solo lugar.',
    pool:'nocond',types:null,metric:'duracion_min',unit:'min',
    cTotal:'Total de eventos de no conductores',cMax:'Mayor duración (HH:MM:SS)',cAvg:'Promedio de duración (HH:MM:SS)',col:'Medición',noun:'no conductores',
    cols:['asig','clasif','unidad','tad','mes','dia','hora','tipo','med','estatus','motivo']},
  comparador:{title:'Comparador',icon:'compare'}
};

/* iconos del estudio de gráficas */
Object.assign(IC,{
  bar:'<rect x="4" y="11" width="4" height="9" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="9" width="4" height="11" rx="1"/>',
  barh:'<rect x="4" y="4" width="9" height="4" rx="1"/><rect x="4" y="10" width="16" height="4" rx="1"/><rect x="4" y="16" width="11" height="4" rx="1"/>',
  line:'<path d="M3 17l5-6 4 3 8-9"/><path d="M3 21h18"/>',
  area:'<path d="M3 18l5-7 4 3 8-8v12H3z"/>',
  pie:'<path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.5A9 9 0 0120.5 9H15z"/>',
  doughnut:'<path d="M12 3a9 9 0 109 9"/><path d="M12 7.5A4.5 4.5 0 1016.5 12"/><path d="M12 3v4.5M16.5 12H21"/>',
  combo:'<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="11" y="8" width="4" height="12" rx="1"/><path d="M3 9l6-4 6 3 6-5"/>',
  palette:'<path d="M12 3a9 9 0 100 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 004-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  plusc:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  db:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
  refresh:'<path d="M20 11a8 8 0 10-2.3 6.3M20 4v7h-7"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  sheet:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'
});
