"""ETL: lee los Excel de la carpeta de entrada, unifica nombres y llena la base SQLite.
Se puede correr las veces que quieras: un evento ya cargado no se duplica."""
import datetime as dt
import numbers
import re
import shutil
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from database import conectar  # noqa: E402
from reglas_eventos import nombre_tad, normalizar_estatus, sin_acentos, unificar_evento  # noqa: E402

# Nombres de columna que se aceptan para cada dato (sin acentos, mayusculas ni espacios).
# Datos exel crud

UNIDAD_NUMERO_SUELTO = "min"     # si "Duración" llega como número sin formato de hora: "min" o "seg"
ALIAS = {
    "vehiculo": ["vehiculo", "unidad", "numeconomico", "numeroeconomico", "noeconomico", "economico"],
    "vin": ["vin", "numeroserievin", "numeroserie"],
    "grupo": ["grupodeconductores", "grupo", "tad", "terminal"],
    "grupo_veh": ["grupodevehiculos", "grupodevehiculo", "grupovehiculos", "grupovehiculo"],
    "conductor": ["nombredelconductor", "conductor", "operador", "chofer"],
    "categoria": ["categoriadelevento", "categoria"],
    "evento": ["tipodeevento", "evento", "alerta"],
    "duracion": ["duracion"],
    "inicio": ["horainicio", "inicio", "fechainicio", "horadeinicio"],
    "final": ["horafinal", "final", "fin", "horafin", "horadefinal"],
    "direccion": ["direccion", "ubicacion"],
    "km": ["kilometraje", "km", "odometro"],
    "vel": ["velocidad"],
    "velmax": ["velocidadmax", "velocidadmaxima", "velmax"],
    "estatus": ["estatus", "estado", "clasificacion", "status"],
}
OBLIGATORIAS = ["vehiculo", "evento", "inicio"]

def limpiar_texto(valor):
    if valor is None or pd.isna(valor):
        return None
    texto = str(valor).strip()
    return texto or None

def elegir_tad(*valores):
    """Devuelve el grupo con un nombre ya conocido por el panel (TAD_ALIAS); si no, el primero con forma
    TAD-###-NOMBRE y, en su defecto, el primero con texto."""
    textos = [limpiar_texto(v) for v in valores]
    for t in textos:
        if t and nombre_tad(t) != t:
            return t
    for t in textos:
        if t and re.match(r"TAD-\d{3}-", t):
            return t
    return next((t for t in textos if t), "Sin grupo")


def clave_columna(nombre):
    return re.sub(r"[^a-z0-9]", "", sin_acentos(str(nombre)).lower())


def renombrar_columnas(df):
    mapa, usados = {}, set()
    for col in df.columns:
        k = clave_columna(col)
        for canonico, alias in ALIAS.items():
            if canonico not in usados and k in alias:
                mapa[col] = canonico
                usados.add(canonico)
                break
    faltan = [c for c in OBLIGATORIAS if c not in usados]
    if faltan:
        raise ValueError(f"Faltan columnas {faltan}. Encabezados encontrados: {list(df.columns)}")
    return df.rename(columns=mapa)


def fecha_hora(serie):
    """Fechas reales de Excel, numeros de Excel o texto. Texto AAAA-MM-DD se lee como ISO; el resto como dia/mes/anio (MX).
    Excel guarda una fecha sin formato como numero de dias desde 1899-12-30 (ej. 46263.97); se convierte a fecha real."""
    def una(v):
        if isinstance(v, str):
            t = v.strip()
            return pd.to_datetime(t, errors="coerce", dayfirst=not re.match(r"\d{4}[-/]", t))
        if isinstance(v, numbers.Real) and not isinstance(v, bool):
            if pd.isna(v) or v < 1:                  # vacio o solo hora: no es una fecha valida
                return pd.NaT
            return pd.to_datetime(v, unit="D", origin="1899-12-30", errors="coerce").round("s")
        return pd.to_datetime(v, errors="coerce")
    return pd.to_datetime(serie.map(una), errors="coerce")


def segundos(valor):
    """Duración -> segundos. Acepta hh:mm:ss, mm:ss, '12 min', hora de Excel (fracción de día) o número."""
    if valor is None or (not isinstance(valor, (str, dt.time, pd.Timedelta)) and pd.isna(valor)):
        return None
    if isinstance(valor, pd.Timedelta):
        return int(valor.total_seconds())
    if isinstance(valor, (dt.time, dt.datetime)):
        return valor.hour * 3600 + valor.minute * 60 + valor.second
    if isinstance(valor, (int, float)):
        v = float(valor)
        if 0 <= v < 1:                                   # celda con formato de hora de Excel
            return int(round(v * 86400))
        return int(round(v * (60 if UNIDAD_NUMERO_SUELTO == "min" else 1)))
    s = str(valor).strip()
    m = re.fullmatch(r"(\d+):(\d{1,2}):(\d{1,2})(?:\.\d+)?", s)
    if m:
        return int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3])
    m = re.fullmatch(r"(\d+):(\d{1,2})", s)
    if m:
        return int(m[1]) * 60 + int(m[2])
    h = re.search(r"(\d+(?:\.\d+)?)\s*h", s, re.I)
    mi = re.search(r"(\d+(?:\.\d+)?)\s*m(?!s)", s, re.I)
    se = re.search(r"(\d+(?:\.\d+)?)\s*s", s, re.I)
    if h or mi or se:
        return int(round(float(h[1]) * 3600 if h else 0) + (float(mi[1]) * 60 if mi else 0) + (float(se[1]) if se else 0))
    try:
        return segundos(float(s.replace(",", "")))
    except ValueError:
        return None


def numero(valor):
    try:
        return None if pd.isna(valor) else float(valor)
    except (TypeError, ValueError):
        return None


def obtener_id(con, cache, tabla, columna, valor, extra=None):
    if valor in cache:
        return cache[valor]
    fila = con.execute(f"SELECT id FROM {tabla} WHERE {columna} = ?", (valor,)).fetchone()
    if fila:
        cache[valor] = fila[0]
    else:
        columnas = [columna] + list((extra or {}).keys())
        valores = [valor] + list((extra or {}).values())
        marcas = ",".join("?" * len(columnas))
        cur = con.execute(f"INSERT INTO {tabla} ({','.join(columnas)}) VALUES ({marcas})", valores)
        cache[valor] = cur.lastrowid
    return cache[valor]


def cargar_archivo(con, ruta, caches, sin_clasificar):
    df = renombrar_columnas(pd.read_excel(ruta, sheet_name=0))
    leidas = len(df)
    df["inicio"] = fecha_hora(df["inicio"])
    if "final" in df:
        df["final"] = fecha_hora(df["final"])
    df = df.dropna(subset=["vehiculo", "evento", "inicio"])
    descartadas = leidas - len(df)

    tiene_grupo_veh = "grupo_veh" in df.columns
    if not tiene_grupo_veh:
        print(f"AVISO {ruta.name}: no trae la columna 'Grupo de vehiculos'; el TAD se toma de 'Grupo de conductores'.")
    carga_id = con.execute("INSERT INTO cargas (archivo, filas_leidas) VALUES (?, ?)",
                           (ruta.name, leidas)).lastrowid
    nuevas = duplicadas = actualizadas = 0
    for r in df.to_dict("records"):
        unidad = limpiar_texto(r["vehiculo"])
        nombre_ev = limpiar_texto(r["evento"])
        if not unidad or not nombre_ev:
            descartadas += 1
            continue
        # TAD = columna "Grupo de vehiculos". Solo si el Excel no la trae se usa "Grupo de conductores".
        #agregado 101 octubre martes
        
        grupo = elegir_tad(r.get("grupo_veh"), r.get("grupo"))
        grupo_id = obtener_id(con, caches["grupo"], "grupos_vehiculos", "nombre", grupo)
        veh_id = obtener_id(con, caches["veh"], "vehiculos", "num_economico", unidad,
                            {"vin": limpiar_texto(r.get("vin")), "grupo_id": grupo_id})
        nombre_cond = limpiar_texto(r.get("conductor"))
        cond_id = obtener_id(con, caches["cond"], "conductores", "nombre", nombre_cond) if nombre_cond else None
        if nombre_ev not in caches["ev"]:
            evento, ok = unificar_evento(nombre_ev, limpiar_texto(r.get("categoria")))
            if not ok:
                sin_clasificar.add(nombre_ev)
            obtener_id(con, caches["ev"], "tipos_evento", "nombre_original", nombre_ev,
                       {"evento": evento, "clasificado": ok})
        ev_id = caches["ev"][nombre_ev]

        # El estatus ya no sale de un comentario: lo marca el boton "Descartada" del panel
        # (o la columna Estatus del Excel, que nunca pisa una marca existente).
        estatus = normalizar_estatus(limpiar_texto(r.get("estatus")))
        t0 = r["inicio"]
        t1 = r.get("final")
        if t1 is not None and pd.isna(t1):
            t1 = None
        dur = segundos(r.get("duracion"))                     # columna Duración; si no viene, Hora Final - Hora Inicio
        if dur is None and t1 is not None:
            dur = int((t1 - t0).total_seconds())
        cur = con.execute(
            """INSERT OR IGNORE INTO eventos (vehiculo_id, conductor_id, tipo_evento_id, carga_id,
               hora_inicio, hora_final, direccion, kilometraje, velocidad, velocidad_max, duracion_seg, estatus,
               categoria, grupo_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (veh_id, cond_id, ev_id, carga_id, t0.strftime("%Y-%m-%d %H:%M:%S"),
             None if t1 is None else t1.strftime("%Y-%m-%d %H:%M:%S"),
             limpiar_texto(r.get("direccion")), numero(r.get("km")), numero(r.get("vel")),
             numero(r.get("velmax")) if numero(r.get("velmax")) is not None else numero(r.get("vel")),
             dur, estatus, limpiar_texto(r.get("categoria")), grupo_id))
        if cur.rowcount:
            nuevas += 1
        else:
            duplicadas += 1
            con.execute("UPDATE eventos SET grupo_id = ? WHERE vehiculo_id = ? AND hora_inicio = ? AND tipo_evento_id = ? "
                        "AND IFNULL(grupo_id, 0) <> ?",
                        (grupo_id, veh_id, t0.strftime("%Y-%m-%d %H:%M:%S"), ev_id, grupo_id))   # corrige el TAD de lo ya cargado
            if estatus:     # el Excel puede traer un estatus corregido para un evento ya cargado
                actualizadas += con.execute(
                    """UPDATE eventos SET estatus = ? WHERE vehiculo_id = ? AND hora_inicio = ?
                       AND tipo_evento_id = ? AND estatus IS NULL""",
                    (estatus, veh_id, t0.strftime("%Y-%m-%d %H:%M:%S"), ev_id)).rowcount
    con.execute("UPDATE cargas SET filas_nuevas=?, filas_duplicadas=?, filas_descartadas=? WHERE id=?",
                (nuevas, duplicadas, descartadas, carga_id))
    return leidas, nuevas, duplicadas, descartadas, actualizadas


def archivar_antiguos(con):
    """Mueve a Entrada\\Historial los Excel cuyo evento mas reciente ya quedo fuera de la ventana de meses."""
    ultimo = con.execute("SELECT MAX(substr(hora_inicio, 1, 7)) FROM eventos").fetchone()[0]
    if not ultimo:
        return
    anio, mes = map(int, ultimo.split("-"))
    pos = anio * 12 + (mes - 1) - (config.MESES_HISTORIAL - 1)
    limite = f"{pos // 12:04d}-{pos % 12 + 1:02d}"          # primer mes que se conserva a la vista
    for ruta in sorted(config.CARPETA_ENTRADA.glob("*.xlsx")):
        if ruta.name.startswith("~$"):
            continue
        reciente = con.execute(
            """SELECT MAX(substr(e.hora_inicio, 1, 7)) FROM eventos e
               JOIN cargas c ON c.id = e.carga_id WHERE c.archivo = ?""", (ruta.name,)).fetchone()[0]
        if reciente and reciente < limite:
            config.CARPETA_HISTORIAL.mkdir(exist_ok=True)
            destino = config.CARPETA_HISTORIAL / ruta.name
            if destino.exists():
                print(f"Historial: ya existe {ruta.name}, no se mueve.")
                continue
            shutil.move(str(ruta), str(destino))
            print(f"Historial: {ruta.name} (ultimo evento {reciente}) -> carpeta Historial")


def main():
    # config.xlsx_validos trae Entrada, sus carpetas de ano y de mes (Entrada\2026\Enero) y todo Historial.
    # Con ANIOS_CARGA (Backend\.env, o -Anios del actualizador) solo baja por las carpetas de esos anos.
    archivos = config.xlsx_validos()
    anios = config.anios_carga()
    print("Anios a leer: " + (", ".join(sorted(anios)) if anios else "todos")
          + f"   ({len(archivos)} Excel en las carpetas de Entrada)")
    if not archivos:
        print(f"No hay archivos .xlsx en: {config.CARPETA_ENTRADA}")
        print("  (se buscan tambien sus carpetas de ano y de mes, Entrada\\2026\\Enero, y todo Historial)")
        print("  (si esa carpeta no existe en este equipo, revisa CARPETA_ENTRADA en Backend\\.env:"
              " la letra de la unidad o la carpeta de OneDrive cambian entre equipos)")
        return 1
    con = conectar()
    for tid, original in con.execute("SELECT id, nombre_original FROM tipos_evento").fetchall():
        evento, ok = unificar_evento(original)          # las reglas pueden haber cambiado desde la ultima carga
        con.execute("UPDATE tipos_evento SET evento = ?, clasificado = ? WHERE id = ?", (evento, ok, tid))
    con.commit()
    cargados = {f[0] for f in con.execute("SELECT archivo FROM cargas")}
    # Lo que ya esta en Historial solo se lee si la base no lo tiene (por ejemplo, si la base se recreo).
    # En Entrada y en sus carpetas de ano el archivo si se vuelve a leer: puede traer filas nuevas.
    def en_historial(p):
        try:
            return p.is_relative_to(config.CARPETA_HISTORIAL)
        except (OSError, ValueError):
            return False
    archivos = [p for p in archivos if p.name not in cargados or not en_historial(p)]
    caches = {k: {} for k in ("grupo", "veh", "cond", "ev")}
    sin_clasificar = set()
    try:
        for ruta in archivos:
            try:
                l, n, d, x, u = cargar_archivo(con, ruta, caches, sin_clasificar)
                con.commit()
                print(f"{ruta.name}: leidas {l} | nuevas {n} | repetidas {d} | estatus actualizado {u} | descartadas {x}")
            except Exception as e:  # un archivo malo no detiene a los demas
                con.rollback()
                print(f"ERROR en {ruta.name}: {e}")
        if config.ARCHIVAR_HISTORIAL:
            archivar_antiguos(con)
        total = con.execute("SELECT COUNT(*) FROM eventos").fetchone()[0]
    finally:
        con.close()
    print(f"Total de eventos en la base: {total}")
    if sin_clasificar:
        print("Eventos SIN REGLA (agrega una regla en Backend\\reglas_eventos.py):")
        for nombre in sorted(sin_clasificar):
            print("  -", nombre)
    return 0


if __name__ == "__main__":
    sys.exit(main())
