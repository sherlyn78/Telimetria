"""Nombres de evento que usa el dashboard y reglas para unificar los nombres del Excel.
UNICO lugar donde se editan: si Traffilog/OnCommand cambia un nombre, agrega una regla aqui."""
import unicodedata

AV = "Alta velocidad"
FR = "Frenado de pánico"
NE = "Manejo en neutral"
RC = "RPM >2000 con pedal"
RS = "RPM >2000 sin pedal"
R20 = "Ralentí >20 min"
RP = "Pemex - Ralentí >15 min"
RF = "RPM >1400 con motor frío"
FH = "Freno nivel alto"

EVENTOS = [AV, FR, FH, NE, RC, RS, RF, R20, RP]   # todos los eventos que el panel conoce
# Eventos que se miden en minutos; el resto se mide en km/h. NE entra aqui porque el Excel si trae
# su duracion (promedio ~17 segundos): sin esto el generador la mandaba en null y la columna
# "Duracion" de Neutral salia vacia aunque la base tuviera el dato.
TIPOS_DURACION = {RC, RS, RF, R20, RP, NE}

# Tipos que ya NO salen en el panel: ni en tablas, ni gráficas, ni KPIs.
# Debe coincidir con OCULTOS de Frontend\src\js\01_config.js.
OCULTAR_EN_PANEL = {RP, RF}


# (palabras que TODAS deben aparecer en el nombre del Excel, evento). Se prueban en orden.
REGLAS = [
    (("ralenti", "15"), RP),
    (("ralenti", "20"), R20),      # viene antes que "pemex ralenti": 'Pemex - Ralenti Mayor a 20 Minutos' es de 20 min
    (("ralenti",), R20),
    (("pemex", "ralenti"), RP),
    (("rpm", "2000", "sin el pedal"), RS),
    (("rpm", "2000", "con el pedal"), RC),
    (("rpm", "sin pedal"), RS),
    (("rpm", "con pedal"), RC),
    (("velocidad", "nivel alto"), AV),
    (("freno", "nivel alto"), FH),  # 'Freno nivel alto' NO es frenado de pánico; va antes que las reglas de freno
    (("alta velocidad",), AV),
    (("rpm", "1400", "refrigerante"), RF),
    (("exceso", "velocidad"), AV),
    (("speed",), AV),
    (("panico",), FR),
    (("frenado",), FR),
    (("brak",), FR),
    (("neutral",), NE),
    (("fren",), FR),            # respaldo: cualquier 'fren...'
    (("exceso",), AV),
]

# Unico estatus que se marca: lo demas queda "Sin estatus". Real y Traffilog ya no se usan.
ESTATUS_PANEL = ("Descartada",)
ESTATUS_CONOCIDOS = {"descart": "Descartada"}


def sin_acentos(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def unificar_evento(nombre, categoria=None):
    """Devuelve (evento_unificado, clasificado). clasificado=0 si ninguna regla coincide.
    Se prueba con el Tipo de Evento y, si no basta, junto con la Categoria del Evento."""
    base = sin_acentos(nombre).lower()
    for palabras, evento in REGLAS:
        if all(p in base for p in palabras):
            return evento, 1
    if categoria:
        base = sin_acentos(f"{nombre} {categoria}").lower()
    for palabras, evento in REGLAS:
        if all(p in base for p in palabras):
            return evento, 1
    return nombre.strip(), 0


def normalizar_estatus(valor):
    if valor is None:
        return None
    base = sin_acentos(str(valor)).strip().lower()
    for prefijo, nombre in ESTATUS_CONOCIDOS.items():
        if base.startswith(prefijo):
            return nombre
    return None


def estatus_panel(valor):
    """Lo que el panel sabe mostrar: Descartada o nada. Un 'Real' viejo queda sin estatus."""
    base = sin_acentos(str(valor or "")).strip()
    return base if base in ESTATUS_PANEL else ""

NO_CONDUCTOR_EXACTOS = {"CAPACITACION", "DISPONIBLE", "TRASLADOS"}
NO_CONDUCTOR_PREFIJOS = ("TALLER EXTERNO", "TECNICO ASE")

# Grupos que en el Excel vienen con otro nombre y en el panel deben leerse asi (clave sin acentos y en mayusculas).
TAD_ALIAS = {sin_acentos("Durango - Gpe. Victoria").upper(): "TIS DURANGO"}


def nombre_tad(nombre):
    base = sin_acentos(str(nombre or "").strip().upper())
    return TAD_ALIAS.get(base, nombre)


def es_no_conductor(nombre):
    if not nombre:
        return False
    base = sin_acentos(str(nombre)).strip().upper()
    return base in NO_CONDUCTOR_EXACTOS or base.startswith(NO_CONDUCTOR_PREFIJOS)


def clasificacion_no_conductor(nombre):
    """Agrupa CAPACITACIÓN, DISPONIBLE, talleres, técnicos ASE y TRASLADOS."""
    if not nombre:
        return "Sin conductor"
    base = sin_acentos(str(nombre)).strip().upper()
    if base == "CAPACITACION":
        return "Capacitación"
    if base == "DISPONIBLE":
        return "Disponible"
    if base.startswith("TALLER EXTERNO"):
        return "Taller externo"
    if base.startswith("TECNICO ASE"):
        return "Técnico ASE"
    if base == "TRASLADOS":
        return "Traslados"
    return "No conductor"