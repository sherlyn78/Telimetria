"""Une las piezas de Frontend/src (HTML, CSS, JS, fuentes) con los datos de la base y deja
UN solo dashboard.html en la carpeta de salida. No necesita internet ni servidor para abrirse."""
import base64
import json
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from database import conectar  # noqa: E402
from reglas_eventos import OCULTAR_EN_PANEL, TIPOS_DURACION, clasificacion_no_conductor, es_no_conductor, estatus_panel, nombre_tad  # noqa: E402

MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
             "Septiembre", "Octubre", "Noviembre", "Diciembre"]
MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

CONSULTA = """
SELECT e.hora_inicio, g.nombre, v.num_economico, c.nombre, t.evento,
       e.velocidad_max, e.duracion_seg, e.estatus, e.hora_final,
       e.id, e.motivo, e.protocolo, e.protocolo_arch
FROM eventos e
JOIN vehiculos v ON v.id = e.vehiculo_id
JOIN grupos_vehiculos g ON g.id = COALESCE(e.grupo_id, v.grupo_id)
JOIN tipos_evento t ON t.id = e.tipo_evento_id
LEFT JOIN conductores c ON c.id = e.conductor_id
WHERE substr(e.hora_inicio, 1, 7) IN ({marcas})
ORDER BY e.hora_inicio
"""


def armar_datos(con):
    meses = sorted(m[0] for m in con.execute(
        "SELECT DISTINCT substr(hora_inicio, 1, 7) m FROM eventos ORDER BY m DESC LIMIT ?",
        (config.MESES_HISTORIAL,)))
    if not meses:
        return None
    crudas = [[r[0], nombre_tad(r[1])] + list(r[2:]) for r in
              con.execute(CONSULTA.format(marcas=",".join("?" * len(meses))), meses)]
    # Tipos que el panel ya no muestra (reglas_eventos.OCULTAR_EN_PANEL)
    n_ocultos = sum(1 for r in crudas if r[4] in OCULTAR_EN_PANEL)
    if n_ocultos:
        crudas = [r for r in crudas if r[4] not in OCULTAR_EN_PANEL]
        print(f"AVISO: {n_ocultos} eventos quedan fuera del panel ({', '.join(sorted(OCULTAR_EN_PANEL))}). "
              "Siguen en la base; se muestran otra vez si se quitan de esa lista.")
    # El filtro TAD lista TODOS los grupos de la tabla Grupo de vehiculos, aunque no tengan eventos en el periodo.
    grupos_tabla = {nombre_tad(n) for (n,) in con.execute("SELECT nombre FROM grupos_vehiculos")}
    # Fuera de General y de los módulos de conductor:
    #  - sin conductor y TAD oculto → boton "Omitidos" (modal)
    #  - CAPACITACION, DISPONIBLE, TALLER EXTERNO..., TECNICO ASE..., TRASLADOS y sin conductor → modulo "No conductores"
    ocultar_tads = {t.strip().upper() for t in config._ENV.get("OCULTAR_TADS", "").split(";") if t.strip()}

    def motivo(r):
        if not r[3]:
            return "Sin conductor"
        if es_no_conductor(r[3]):
            return "No es conductor"
        if (r[1] or "").strip().upper() in ocultar_tads:
            return "TAD oculto"
        return None

    def compacta(r, m):   # [fecha, hora, TAD, unidad, conductor, evento, estatus, razon, clave, id, motivo]
        return [r[0][:10], r[0][11:16], r[1], r[2], r[3] or "", r[4], estatus_panel(r[7]), m,
                f"{r[0]}|{r[2]}|{r[4]}", r[9], r[10] or ""]

    visibles, omitidos, nocond = [], [], []
    for r in crudas:
        m = motivo(r)
        if m == "TAD oculto":
            omitidos.append(compacta(r, m))
        elif m:
            if m == "Sin conductor":
                omitidos.append(compacta(r, m))
            nocond.append(r)
        else:
            visibles.append(r)
    print(f"Eventos de no conductores (módulo propio): {len(nocond)}")
    print(f"Eventos en el modal de omitidos (sin conductor o TAD oculto): {len(omitidos)}")
    n_tad = sum(1 for o in omitidos if o[7] == "TAD oculto")
    if n_tad:
        print(f"AVISO: {n_tad} eventos ocultos por OCULTAR_TADS ({', '.join(sorted(ocultar_tads))}). "
              "Revise la columna Grupo de vehiculos del Excel.")
    if not visibles and not nocond:
        return None

    nombres_op = {r[3] for r in visibles if r[3]}
    nombres_nc = {r[3] for r in nocond if r[3]}
    nombre_map = {}
    for n in sorted(nombres_op):
        nombre_map[n] = f"Cond-{len(nombre_map) + 1:03d}" if config.OCULTAR_CONDUCTORES else n
    for n in sorted(nombres_nc):
        nombre_map.setdefault(n, n)
    todos = visibles + nocond
    pos = lambda lista: {v: i for i, v in enumerate(lista)}  # noqa: E731
    tads = sorted({r[1] for r in todos} | grupos_tabla)
    unidades = sorted({r[2] for r in todos})
    tipos = sorted({r[4] for r in todos})
    estatus = sorted({estatus_panel(r[7]) or "Sin estatus" for r in todos})
    cond_lista = sorted(set(nombre_map.values()))
    m_i, t_i, u_i, e_i, s_i, c_i = pos(meses), pos(tads), pos(unidades), pos(tipos), pos(estatus), pos(cond_lista)

    filas, tad_de, uni_de = [], {}, {}
    def agregar(r, es_nc):
        ts, tad, uni, cond, ev, vmax, dur, est, hfin, eid, mot, proto, arch = r
        if cond:
            tad_de.setdefault(cond, Counter())[tad] += 1
            uni_de.setdefault(cond, Counter())[uni] += 1
        minutos = round((dur or 0) / 60, 1) if ev in TIPOS_DURACION else None
        # Orden de la fila (lo lee Frontend\src\js\00_datos.js): fecha, hora, mes, tad, conductor, unidad,
        # evento, velocidad, minutos, estatus, hora fin, id, motivo, es_no_conductor, clasificacion,
        # protocolo (casilla si/no) y si ya trae archivo de protocolo.
        filas.append([ts[:10], ts[11:16], m_i[ts[:7]], t_i[tad], c_i[nombre_map[cond]] if cond else -1,
                      u_i[uni], e_i[ev], int(round(vmax)) if vmax is not None else 0, minutos,
                      s_i[estatus_panel(est) or "Sin estatus"], hfin[11:16] if hfin else "", eid, mot or "",
                      1 if es_nc else 0, clasificacion_no_conductor(cond) if es_nc else "",
                      1 if proto == "1" else 0, 1 if arch else 0])
    for r in visibles:
        agregar(r, False)
    for r in nocond:
        agregar(r, True)
    conductores = [{"nombre": nombre_map[n], "tad": tad_de[n].most_common(1)[0][0],
                    "num": uni_de[n].most_common(1)[0][0],
                    "nocond": n in nombres_nc and n not in nombres_op} for n in sorted(nombre_map)]
    conductores.sort(key=lambda c: c["nombre"])

    def etiqueta(m, largo):
        a, mm = int(m[:4]), int(m[5:7]) - 1
        return f"{MES_LARGO[mm]} {a}" if largo else MES_CORTO[mm]
    a0, a1 = meses[0], meses[-1]
    return {
        "meses": [{"key": m, "largo": etiqueta(m, True), "corto": etiqueta(m, False)} for m in meses],
        "rangoLargo": etiqueta(a0, True) if a0 == a1 else f"{etiqueta(a0, True)} – {etiqueta(a1, True)}",
        "rangoCorto": f"{etiqueta(a0, False)} {a0[:4]}" if a0 == a1
                      else f"{etiqueta(a0, False)} {a0[:4]} – {etiqueta(a1, False)} {a1[:4]}",
        "actualizado": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "tads": tads, "unidades": unidades, "tipos": tipos, "estatus": estatus,
        "conductores": conductores, "filas": filas, "omitidos": omitidos,
    }


def fuentes_css():
    """Incrusta las tipografias (woff2) en el CSS para que no dependan de internet."""
    bloques = []
    for f in sorted((config.FUENTES / "fonts").glob("*.woff2")):
        familia, peso = f.stem.split("-")
        b64 = base64.b64encode(f.read_bytes()).decode()
        bloques.append(f"@font-face{{font-family:'{familia.capitalize()}';font-weight:{peso};font-style:normal;"
                       f"font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2')}}")
    return "\n".join(bloques)


def leer_carpeta(sub, ext):
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted((config.FUENTES / sub).glob(f"*.{ext}")))


def ensamblar(datos):
    html = (config.FUENTES / "index.template.html").read_text(encoding="utf-8")
    json_datos = json.dumps(datos, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    chartjs = (config.FUENTES / "libs" / "chart.umd.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
    logo = logo_uri()
    for marca, contenido in (("/*@FUENTES*/", fuentes_css()), ("/*@CSS*/", leer_carpeta("css", "css")),
                             ("/*@CHARTJS*/", chartjs),
                             ("<!--@DATOS-->", json_datos), ("<!--@FAVICON-->", logo),
                             ("<!--@LOGO-->", f'<img src="{logo}" alt="PEMEX">' if logo else ""),
                             ("<!--@JS-->", leer_carpeta("js", "js"))):
        assert marca in html, f"Falta la marca {marca} en index.template.html"
        html = html.replace(marca, contenido)
    return html

def logo_uri():
    """El logo de PEMEX como datos incrustados: sirve de favicon y del isotipo del menu lateral."""
    f = config.FUENTES / "img" / "Logo_Petróleos_Mexicanos.svg"
    if not f.exists():
        return ""
    return "data:image/svg+xml;base64," + base64.b64encode(f.read_bytes()).decode()


def main():
    if not config.RUTA_BD.exists():
        print("No existe la base. Primero corre la carga de Excel (etl/limpieza.py).")
        return 1
    con = conectar()
    datos = armar_datos(con)
    con.close()
    if datos is None:
        print("La base no tiene eventos. Carga primero un Excel.")
        return 1
    html = ensamblar(datos)
    config.CARPETA_SALIDA.mkdir(parents=True, exist_ok=True)
    destino = config.CARPETA_SALIDA / config.NOMBRE_HTML
    temporal = destino.with_suffix(".tmp")      # se escribe aparte y se renombra
    temporal.write_text(html, encoding="utf-8")
    for intento in range(5):                    # Drive a veces bloquea el archivo unos segundos
        try:
            os.replace(temporal, destino)
            break
        except PermissionError:
            if intento == 4:
                print("No se pudo reemplazar el dashboard: el archivo esta abierto o en uso. Cierralo y reintenta.")
                return 1
            time.sleep(2)
    print(f"Dashboard generado: {destino} ({destino.stat().st_size // 1024} KB)")
    print(f"Eventos incluidos: {len(datos['filas'])} | periodo: {datos['rangoLargo']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
