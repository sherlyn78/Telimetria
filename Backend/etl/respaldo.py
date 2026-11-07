"""Copia de seguridad de la base antes de cada carga. Guarda en Base_Datos\\respaldos y conserva solo las ultimas N.
Copia la base con SQLite (VACUUM INTO, con tiempo maximo de espera), la VERIFICA y solo entonces la deja con su nombre final.
Si RESPALDOS_ONEDRIVE esta en el .env, cada respaldo se copia tambien a esa carpeta de Drive."""
import shutil
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402

CONSERVAR = int(config._ENV.get("RESPALDOS_MAX", "6"))


def _total_eventos(ruta):
    con = sqlite3.connect(ruta, timeout=30)
    try:
        return con.execute("SELECT COUNT(*) FROM eventos").fetchone()[0]
    finally:
        con.close()


def _revisar(ruta):
    """Integridad + conteo, cerrando SIEMPRE la conexion (en Windows una conexion abierta bloquea el archivo)."""
    con = sqlite3.connect(ruta, timeout=30)
    try:
        return con.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        con.close()


def _reemplazar(origen, destino):
    """Renombra el .tmp; si Windows, el antivirus u OneDrive lo tienen tomado, reintenta unos segundos."""
    for intento in range(8):
        try:
            origen.replace(destino)
            return
        except PermissionError:
            if intento == 7:
                raise
            time.sleep(1.5)


def _copia_onedrive(archivo):
    """La segunda copia, en Drive (RESPALDOS_ONEDRIVE en Backend\\.env). Es un extra: si este equipo
    no tiene esa carpeta o no se puede escribir, se avisa y se sigue, porque ACTUALIZAR_UI.ps1 aborta
    toda la actualizacion cuando este script devuelve un codigo distinto de 0."""
    destino, error = config.carpeta_respaldos_onedrive()
    if error:
        print(f"AVISO: no se copio el respaldo a Drive: {error}")
        return
    if destino is None:
        print("AVISO: sin copia en Drive: este equipo no tiene la carpeta de OneDrive del .env (o la que hay"
              " esta en la misma USB); el respaldo quedo solo en Base_Datos\\respaldos")
        return
    for resto in list(destino.glob("*.tmp")):
        try:
            resto.unlink()
        except OSError:
            pass
    copia = destino / archivo.name
    parcial = copia.with_suffix(".tmp")
    try:
        if not copia.exists():
            shutil.copy2(archivo, parcial)
            if parcial.stat().st_size != archivo.stat().st_size:
                raise OSError(f"la copia quedo incompleta ({parcial.stat().st_size} de {archivo.stat().st_size} bytes)")
            _reemplazar(parcial, copia)
    except Exception as e:
        try:
            parcial.unlink()
        except OSError:
            pass
        print(f"AVISO: no se copio el respaldo a Drive ({e})")
        return
    print(f"Respaldo en Drive: {copia.name} ({copia.stat().st_size // 1024} KB)  ->  {destino}")
    viejos = sorted(destino.glob(f"{config.RUTA_BD.stem}_*.db"))[:-CONSERVAR]
    borrados = 0
    for v in viejos:
        try:
            v.unlink()      # OneDrive puede tenerlo tomado mientras sincroniza: no se aborta por eso
            borrados += 1
        except OSError:
            pass
    if borrados:
        print(f"Respaldos antiguos borrados en Drive: {borrados} (se conservan los ultimos {CONSERVAR})")


def main():
    if not config.RUTA_BD.exists():
        print("Respaldo: todavia no hay base, no hay nada que copiar.")
        return 0
    carpeta = config.RUTA_BD.parent / "respaldos"
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / f"{config.RUTA_BD.stem}_{datetime.now():%Y%m%d_%H%M%S}.db"
    parcial = destino.with_suffix(".tmp")
    for resto in list(carpeta.glob("*.tmp")) + list(carpeta.glob("*.tmp-journal")):
        # restos de un respaldo interrumpido; el -journal lo deja SQLite al copiar y nadie mas lo quita
        try:
            resto.unlink()
        except OSError:
            pass
    origen = None
    try:
        # VACUUM INTO respeta el tiempo de espera (backup() de Python espera para siempre si la base esta ocupada)
        origen = sqlite3.connect(config.RUTA_BD, timeout=20)
        origen.execute("PRAGMA busy_timeout = 20000")
        origen.execute("VACUUM INTO ?", (str(parcial),))
        origen.close(); origen = None
        revision = _revisar(parcial)
        if revision != "ok":
            raise RuntimeError(f"la copia no paso la revision de integridad: {revision}")
        n_orig, n_copia = _total_eventos(config.RUTA_BD), _total_eventos(parcial)
        if n_orig != n_copia:
            raise RuntimeError(f"la copia tiene {n_copia} eventos y la base {n_orig}")
        _reemplazar(parcial, destino)
    except sqlite3.OperationalError as e:
        if "locked" in str(e) or "busy" in str(e):
            print("ERROR en el respaldo: la base esta ocupada por otro programa (otra ventana de ACTUALIZAR, DB Browser o la tarea programada).")
            print("Cierre ese programa y vuelva a intentar.")
        else:
            print(f"ERROR en el respaldo: {e}")
        print(f"Base: {config.RUTA_BD}")
        return 1
    except Exception as e:
        print(f"ERROR en el respaldo: {e}")
        print(f"Base: {config.RUTA_BD}")
        return 1
    finally:
        if origen:
            origen.close()
        if parcial.exists():
            try:
                parcial.unlink()
            except OSError:
                pass
    print(f"Respaldo creado: {destino.name} ({destino.stat().st_size // 1024} KB, {n_copia} eventos, integridad ok)")
    viejos = sorted(carpeta.glob(f"{config.RUTA_BD.stem}_*.db"))[:-CONSERVAR]
    for v in viejos:
        v.unlink()
    if viejos:
        print(f"Respaldos antiguos borrados: {len(viejos)} (se conservan los ultimos {CONSERVAR})")
    _copia_onedrive(destino)
    return 0


if __name__ == "__main__":
    sys.exit(main())
