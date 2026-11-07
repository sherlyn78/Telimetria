"""Rutas y opciones del proyecto. Lee el .env de la raiz (y Backend/.env manda mas); si falta, .env.example."""
import json
import os
import string
import unicodedata
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
RAIZ = BACKEND.parent


def _leer_env():
    valores = {}
    # Se usa .env.example como base: evita acabar escribiendo en la raiz de la USB por error.
    for archivo in (RAIZ / ".env.example", BACKEND / ".env.example", RAIZ / ".env", BACKEND / ".env"):
        if not archivo.exists():
            continue
        for linea in archivo.read_text(encoding="utf-8-sig").splitlines():
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, _, valor = linea.partition("=")
            valores[clave.strip()] = valor.strip().strip('"').strip("'")
    return valores


_ENV = _leer_env()

_RAICES = None


def _raices_onedrive(nombre):
    """Carpetas del equipo que se llamen exactamente `nombre` y esten donde suele estar OneDrive:
    las variables ONE_DRIVE*, la carpeta personal y la raiz de cada letra de unidad.
    Solo se explora cuando falta una ruta del .env, y el resultado queda en memoria."""
    global _RAICES
    if _RAICES is None:
        _RAICES = []
        vistos = set()

        def agrega(p):
            try:
                if p and p.is_dir():
                    p = p.resolve()
                    k = str(p).lower()
                    if k not in vistos:
                        vistos.add(k)
                        _RAICES.append(p)
            except OSError:
                pass

        for var in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
            if os.environ.get(var):
                agrega(Path(os.environ[var]))
        base = Path.home()
        agrega(base)
        sitios = [base]
        usuarios = Path("C:/Users")
        if usuarios.is_dir():
            try:
                sitios += [p for p in usuarios.iterdir() if p.is_dir()]
            except OSError:
                pass
        for s in sitios:
            try:
                for p in s.iterdir():
                    if p.name.lower().startswith("onedrive"):
                        agrega(p)
            except OSError:
                pass
        for letra in string.ascii_uppercase:
            raiz = Path(f"{letra}:/")
            if not raiz.is_dir():
                continue
            try:
                for p in raiz.iterdir():
                    if p.name.lower().startswith("onedrive"):
                        agrega(p)
            except OSError:
                pass
    return [r for r in _RAICES if r.name.lower() == nombre.lower()]


def _opciones(c):
    """Rutas posibles para un valor del .env."""
    absoluta = c if c.is_absolute() else RAIZ / c
    partes = [p for p in c.parts if not p.endswith(":\\")]
    for i, p in enumerate(partes):
        if p.lower().startswith("onedrive"):
            cola = Path(*partes[i + 1:]) if len(partes) > i + 1 else Path()
            variantes = [r / cola for r in _raices_onedrive(p)]
            return [absoluta] + variantes if c.is_absolute() else variantes + [absoluta]
    return [absoluta]


def _ruta(clave, defecto):
    """Acepta varias rutas separadas por ';' y usa la primera que exista.
    Sirve cuando Drive tiene otra letra en otro equipo (G:, H:...)."""
    valor = _ENV.get(clave, "")
    candidatos = [Path(v.strip()) for v in valor.split(";") if v.strip()] or [Path(defecto)]
    posibles = [p for c in candidatos for p in _opciones(c)]
    for p in posibles:
        if p.exists():
            return p
    return posibles[0]


CARPETA_ENTRADA = _ruta("CARPETA_ENTRADA", RAIZ / "Entrada")
CARPETA_SALIDA = _ruta("CARPETA_SALIDA", RAIZ / "Salida")
# Los archivos de protocolo que se suben desde el panel. Con la ruta de OneDrive primero; si este
# equipo no tiene esa carpeta, se usan los respaldos de la cadena y, al final, Protocolo\ en la USB.
CARPETA_PROTOCOLO = _ruta("CARPETA_PROTOCOLO", RAIZ / "Protocolo")
RUTA_BD = _ruta("RUTA_BD", BACKEND / "Base_Datos" / "monitor_tad.db")
NOMBRE_HTML = _ENV.get("NOMBRE_HTML", "dashboard.html")
MESES_HISTORIAL = int(_ENV.get("MESES_HISTORIAL", "12"))
OCULTAR_CONDUCTORES = _ENV.get("OCULTAR_CONDUCTORES", "0") == "1"
ARCHIVAR_HISTORIAL = _ENV.get("ARCHIVAR_HISTORIAL", "0") == "1"
CARPETA_HISTORIAL = CARPETA_ENTRADA / "Historial"

# Destinatarios con los que sale el reporte por correo. CORREO_PARA y CORREO_CC del .env son el
# respaldo para cuando el panel se abre sin servidor; lo que manda el panel primero es el archivo
# que se guarda con el boton "Guardar como predeterminado" de la propia ventana del correo.
CORREO_PARA = _ENV.get("CORREO_PARA", "")
CORREO_CC = _ENV.get("CORREO_CC", "")
RUTA_DESTINATARIOS = BACKEND / "destinatarios.json"

SCHEMA = BACKEND / "Base_Datos" / "schema.sql"
FUENTES = RAIZ / "Frontend" / "src"

# Los registros del proyecto (actualizacion.log, correo.log, diagnostico.txt, tiempos.log) salen de la
# raiz y van a Registros\\, para que al abrir la USB solo se vean los botones.
CARPETA_REGISTROS = RAIZ / "Registros"


def ruta_registro(nombre):
    """La ruta de un registro del proyecto. La carpeta se crea si falta; si la USB esta de solo lectura
    se usa la raiz igual que antes: es mejor el registro en otro lado que quedarse sin el."""
    try:
        CARPETA_REGISTROS.mkdir(parents=True, exist_ok=True)
        return CARPETA_REGISTROS / nombre
    except OSError:
        return RAIZ / nombre


def destinatarios():
    """(para, cc) con los que sale el reporte. El archivo de la USB manda sobre el .env, porque es lo
    que se edita desde el panel; si no hay archivo o esta malo, se usa el .env. Nunca revienta: sin
    servidor y sin lista, el panel deja los campos vacios y se escriben a mano como siempre."""
    try:
        d = json.loads(RUTA_DESTINATARIOS.read_text(encoding="utf-8-sig"))
        para = str(d.get("para") or "").strip()
        cc = str(d.get("cc") or "").strip()
        if para or cc:
            return para, cc
    except (OSError, ValueError, AttributeError):
        pass
    return CORREO_PARA.strip(), CORREO_CC.strip()


def guarda_destinatarios(para, cc):
    """Escribe Backend\\destinatarios.json con la lista del panel. Los acentos se guardan como estan
    (ensure_ascii=False) para que el archivo se pueda leer y corregir a mano si hace falta."""
    RUTA_DESTINATARIOS.write_text(
        json.dumps({"para": para, "cc": cc}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def protocolo_posibles():
    """Las rutas posibles de la carpeta de Protocolo, en el orden del .env (se expande la de OneDrive)."""
    valor = _ENV.get("CARPETA_PROTOCOLO", "")
    candidatos = [Path(v.strip()) for v in valor.split(";") if v.strip()] or [Path(RAIZ / "Protocolo")]
    return [p for c in candidatos for p in _opciones(c)]


def protocolo_existe(nombre):
    """Si el archivo de protocolo esta en alguna de esas carpetas. No crea ninguna: se usa al leer la base."""
    if not nombre:
        return False
    try:
        return any((p / nombre).is_file() for p in protocolo_posibles() if p.is_dir())
    except OSError:
        return False


def carpeta_protocolo():
    """Carpeta donde se guardan los archivos de protocolo que se suben desde el panel; la crea si falta.
    Usa la primera que exista; si ninguna existe, crea la primera que se pueda crear (su padre ya este),
    para no armar un 'OneDrive - PETROLEOS MEXICANOS' falso dentro de la USB en los equipos donde esa
    carpeta no esta. Devuelve (carpeta, error)."""
    posibles = protocolo_posibles()
    for p in posibles:
        if p.is_dir():
            return p, None
    for p in posibles:
        if p.parent.is_dir():
            try:
                p.mkdir(parents=True, exist_ok=True)
                return p, None
            except OSError as e:
                return None, f"no se pudo crear {p} ({e})"
    return None, ("no hay carpeta de Protocolo en este equipo; ajuste CARPETA_PROTOCOLO en Backend\\.env "
                  f"(se busco en: {', '.join(str(p) for p in posibles)})")


def complementos_posibles():
    """Las rutas posibles de Complementos, la carpeta con la imagen que va al final del reporte (en el
    orden del .env, con la de OneDrive primero y un respaldo dentro de la USB). Cada ruta puede ser la
    carpeta (se toma la imagen que se llame PROTOCOLO, o si no hay ninguna asi, la primera por nombre) o el
    archivo de imagen en si.
    A diferencia de la carpeta de Protocolo, esta NUNCA se crea: si en este equipo no existe, el reporte
    sale sin la imagen y el panel dice donde se busco."""
    valor = _ENV.get("CARPETA_COMPLEMENTOS", "")
    candidatos = [Path(v.strip()) for v in valor.split(";") if v.strip()] or [
        Path(r"OneDrive - PETROLEOS MEXICANOS\Reportes\Alertas_Traffilo_Oncommand\Complementos"),
        RAIZ / "Complementos"]
    return [p for c in candidatos for p in _opciones(c)]


# Las imagenes que Outlook sabe mostrar dentro del cuerpo del mensaje.
IMG_REPORTE = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp"}
IMG_MAX_BYTES = 900_000      # un PNG de mas de ~0.9 MB infla demasiado el correo: mejor no mandarla


# Dentro de una carpeta, la imagen del reporte es la que se llame PROTOCOLO (2026-11-05: al usuario le
# salio "Pemex.png" porque la regla era "la primera por nombre" y en esa carpeta hay mas imagenes).
IMAGEN_PREFERIDA = "protocolo"


def _sin_tildes(t):
    """Minusculas y sin acentos, para comparar nombres sin pelear con como los escriba cada quien."""
    return "".join(c for c in unicodedata.normalize("NFD", t.lower()) if unicodedata.category(c) != "Mn")


def _elige_imagen(tope, anidas=()):
    """De las imagenes que vio una carpeta (las de en medio y las de sus subcarpetas): primero la que se
    llame PROTOCOLO, aunque traiga otro texto alrededor ("Protocolo acciones.png") o este dentro de una
    subcarpeta que se llame PROTOCOLO; si no la hay, la primera por nombre de la carpeta, y si alla no hay
    ninguna, la primera de las subcarpetas."""
    deseada = [q for q in tope if IMAGEN_PREFERIDA in _sin_tildes(q.stem)]
    if deseada:
        return deseada[0]
    deseada = [q for q in anidas if IMAGEN_PREFERIDA in _sin_tildes(q.parent.name)
               or IMAGEN_PREFERIDA in _sin_tildes(q.stem)]
    if deseada:
        return deseada[0]
    return (tope or anidas)[0]


def _imagenes_de(carpeta):
    """(imagenes de la carpeta, imagenes de sus subcarpetas inmediatas), cada grupo en orden de nombre.
    El OSError de la carpeta pedida sube al que llama (es el que tiene que explicar que no se pudo leer);
    el de una subcarpeta solo la deja fuera."""
    contenidos = sorted(carpeta.iterdir(), key=lambda q: q.name.lower())
    tope = [q for q in contenidos if q.is_file() and q.suffix.lower() in IMG_REPORTE]
    anidas = []
    for s in (q for q in contenidos if q.is_dir()):
        try:
            anidas += sorted((q for q in s.iterdir()
                              if q.is_file() and q.suffix.lower() in IMG_REPORTE), key=lambda q: q.name.lower())
        except OSError:
            continue
    return tope, anidas


def carpeta_imagen(imagen):
    """La carpeta de Complementos de la que salio esa imagen (puede ser ella o una subcarpeta suya). Se
    necesita para listar los otros nombres desde el principio, no solo desde la subcarpeta donde cayo."""
    for p in complementos_posibles():
        try:
            if p.is_dir() and _sin_tildes(str(imagen)).startswith(_sin_tildes(str(p))):
                return p
        except OSError:
            continue
    return imagen.parent


def imagenes_cercanas(carpeta, elegida):
    """Los DEMAS nombres de imagen que hay en esa carpeta (los de en medio tal cual, los de una subcarpeta
    como "Protocolo\\archivo.jpg"), para que el panel los muestre: cuando sale un nombre que la persona no
    esperaba, la lista dice si el archivo correcto si esta ahi, como se llama en realidad, o si de plano no
    existe en este equipo."""
    raiz = Path(carpeta)
    try:
        tope, anidas = _imagenes_de(raiz)
    except OSError:
        return []
    nombres = []
    for q in tope + anidas:
        if q == elegida:
            continue
        nombre = q.name if q.parent == raiz else f"{q.parent.name}\\{q.name}"
        if nombre not in nombres:
            nombres.append(nombre)
    return nombres[:12]


def imagen_reporte():
    """La imagen del final del reporte. Cada ruta del .env vale de las dos formas: si senala a un
    archivo de imagen, se usa ese archivo; si senala a una carpeta, se busca ahi y en sus subcarpetas
    (2026-11-05: en la laptop del usuario la carpeta Complementos tiene Pemex.png en medio y el protocolo
    en una subcarpeta, y la regla de "la primera por nombre" escogia el logo). Devuelve (ruta, mime) si la
    encuentra, o (None, motivo) para que el panel y el correo expliquen por que el reporte sale sin ella."""
    vistas = []
    for p in complementos_posibles():
        if p.is_file():
            if p.suffix.lower() not in IMG_REPORTE:
                continue
            q = p
        elif p.is_dir():
            try:
                tope, anidas = _imagenes_de(p)
            except OSError as e:
                vistas.append(f"{p} ({e})")
                continue
            if not tope and not anidas:
                vistas.append(f"{p} (sin imagenes)")
                continue
            q = _elige_imagen(tope, anidas)
        else:
            vistas.append(str(p))
            continue
        try:
            peso = q.stat().st_size
        except OSError as e:
            return None, f"no se pudo leer {q.name} ({e})"
        if peso > IMG_MAX_BYTES:
            return None, (f"{q.name} pesa {peso // 1024} KB; para adjuntarla en el correo dejela en menos de "
                          f"{IMG_MAX_BYTES // 1024} KB")
        return q, IMG_REPORTE[q.suffix.lower()]
    return None, "no hay imagen de reporte; se busco en: " + ", ".join(vistas)


def respaldos_onedrive_posibles():
    """Las carpetas posibles de la segunda copia de los respaldos, en el orden del .env
    (una ruta sin letra se expande debajo del OneDrive que exista en este equipo)."""
    valor = _ENV.get("RESPALDOS_ONEDRIVE", "")
    candidatos = [Path(v.strip()) for v in valor.split(";") if v.strip()]
    return [p for c in candidatos for p in _opciones(c)]


def carpeta_respaldos_onedrive():
    """Donde se copia cada respaldo de la base, ademas de Backend\\Base_Datos\\respaldos.
    Devuelve (carpeta, error) y (None, None) cuando este equipo no tiene ese Drive. Faltan niveles
    (Respaldos\\Base de Datos)? se crean, pero solo debajo de una carpeta 'OneDrive*' que ya exista.
    Se descarta a proposito: (1) una 'OneDrive - ...' plantada en la raiz de una letra, que no es el
    Drive de verdad sino el rastro de un .env mal puesto (aqui es D:\\OneDrive - PETROLEOS MEXICANOS),
    y (2) cualquier ruta que caiga dentro del proyecto, porque una copia en la misma USB no protege de
    nada. Nunca es un error que deba detener la carga: el respaldo local ya esta hecho."""
    for p in respaldos_onedrive_posibles():
        try:
            drive = next((a for a in p.parents
                          if a.name.lower().startswith("onedrive") and a.is_dir()), None)
            if drive is None or drive.parent == drive.parent.parent:
                continue
            if RAIZ in p.parents or p in RAIZ.parents:
                continue
            if p.is_dir():
                return p, None
            p.mkdir(parents=True, exist_ok=True)
            return p, None
        except OSError as e:
            return None, f"no se pudo crear {p} ({e})"
    return None, None


def anios_carga():
    """Los anos que se van a leer en la carga: None = todos.
    Se elige con ANIOS_CARGA, primero la variable de entorno que pasa ACTUALIZAR_UI.ps1 y si no,
    Backend\\.env. Vale "2026" o "2026,2027"; "todos", "all", "*" o vacio dejan todos los anos."""
    v = (os.environ.get("ANIOS_CARGA", "") or _ENV.get("ANIOS_CARGA", "")).strip().lower()
    if not v or v in ("todos", "all", "*"):
        return None
    sale = set()
    for x in v.replace(";", ",").replace(" ", ",").split(","):
        if x.isdigit() and len(x) == 4:
            sale.add(x)
    return sale or None


def _pasa_por_otro_anio(p, anios):
    """True si el camino de p, contado desde Entrada, baja por una carpeta de ano que no esta
    seleccionada. Es lo que deja fuera Entrada\\2025 y tambien Historial\\2025, porque el ano esta
    en el camino. Los Excel sueltos (directo en Entrada o en Historial, sin carpeta de ano) se leen
    siempre: no tienen ano por donde filtrar, y la carga ya los descarta solos por el registro."""
    try:
        partes = p.relative_to(CARPETA_ENTRADA).parts
    except ValueError:
        partes = p.parts
    return any(x.isdigit() and len(x) == 4 and x not in anios for x in partes)


def carpetas_entrada():
    """Carpetas de donde salen los Excel del reporte y de la carga, en el orden en que se leen:
    1) Entrada (solo sus archivos, sin bajar a subcarpetas), 2) las carpetas de ano que esten
    directo en Entrada y todo lo que haya debajo (Entrada\\2026 y Entrada\\2026\\Abril, que es como
    el Area guarda ahora el reporte diario: una carpeta por ano, otra por mes), 3) Historial y todo
    lo que haya debajo (Historial\\2025).
    Las carpetas con otro nombre se ignoran para que una carpeta de pruebas o un respaldo suelto
    no meta Excel repetidos.
    Con ANIOS_CARGA (vease anios_carga) solo bajan por las carpetas de esos anos: es la forma rapida
    de cargar un ano nuevo sin releer todos los Excel viejos."""
    anios = anios_carga()
    sale = [CARPETA_ENTRADA]
    if not CARPETA_ENTRADA.is_dir():
        return sale
    for p in sorted(CARPETA_ENTRADA.iterdir()):
        if not p.is_dir():
            continue
        es_historial = p.name == CARPETA_HISTORIAL.name
        es_anio = p.name.isdigit() and len(p.name) == 4
        if not (es_historial or es_anio):
            continue
        if anios and es_anio and p.name not in anios:
            continue
        sale.append(p)
        sale += [q for q in sorted(p.rglob("*"))
                 if q.is_dir() and (anios is None or not _pasa_por_otro_anio(q, anios))]
    return sale


def xlsx_validos():
    """Los .xlsx legibles de las carpetas de Entrada (vease carpetas_entrada). Sin los ~$ que Excel
    deja abiertos y sin repetir la misma ruta.
    NO se quitan los que se llaman igual en carpetas distintas: con el reporte diario, dos archivos
    que se llaman "Reporte.xlsx" en Enero y en Febrero son reportes distintos, y confundirlos uno
    con otro dejaria un mes entero sin cargar. Si de verdad es la misma copia repetida, la carga la
    detecta sola por (vehiculo, hora, evento) y la cuenta como repetida."""
    sale, vistos = [], set()
    for carpeta in carpetas_entrada():
        try:
            archivos = sorted(carpeta.glob("*.xlsx"))
        except OSError:
            continue
        for p in archivos:
            if p.name.startswith("~$"):
                continue
            try:
                clave = str(p.resolve()).lower()
            except OSError:      # un acceso directo roto: se queda con la ruta tal cual
                clave = str(p).lower()
            if clave in vistos:
                continue
            vistos.add(clave)
            sale.append(p)
    return sale
