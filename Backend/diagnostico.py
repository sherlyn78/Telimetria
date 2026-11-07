r"""Diagnostico del panel en un vistazo: que ve el servidor, que Excel encuentra y por que uno no entra al correo.
Lo llama DIAGNOSTICO.bat con doble clic. SOLO LEE: no toca la base, no mueve archivos, no manda correos, no abre Outlook.
Cada seccion atrapa su propio error para que el informe salga completo aunque algo falle."""
import datetime as dt
import json
import platform
import sqlite3
import sys
import urllib.request
import winreg
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config
import correo

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
         "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def titulo(texto):
    print("\n" + texto.upper())
    print("-" * 72)


def ultimo_error(e):
    print(f"  no se pudo leer: {type(e).__name__}: {e}")


def claves_meses(n=24):
    """Los ultimos n meses como 'AAAA-MM', del mas viejo al mas nuevo."""
    hoy = dt.date.today()
    sale = []
    for i in range(n - 1, -1, -1):
        pos = hoy.year * 12 + (hoy.month - 1) - i
        sale.append(f"{pos // 12:04d}-{pos % 12 + 1:02d}")
    return sale


def seccion_rutas():
    titulo("1. rutas (Backend\\.env -> donde resuelve en este equipo)")
    for clave in ("CARPETA_ENTRADA", "CARPETA_SALIDA", "RUTA_BD"):
        valor = config._ENV.get(clave, "(sin valor, usa el defecto)")
        ruta = getattr(config, clave)
        print(f"  {clave}")
        print(f"     en .env   : {valor}")
        print(f"     resuelta  : {ruta}")
        print(f"     existe    : {'SI' if Path(str(ruta)).exists() else 'NO  <== problema'}")
    nombre = next((p for p in Path(config._ENV.get("CARPETA_ENTRADA", "")).parts
                   if p.lower().startswith("onedrive")), "")
    if nombre:
        raíces = config._raices_onedrive(nombre)
        print(f"  carpetas '{nombre}' encontradas en este equipo: {len(raíces)}")
        for r in raíces:
            print(f"     - {r}")
        if not raíces:
            print("     ninguna: por eso la ruta cae adentro de la USB y el panel no ve los Excel.")
            print("     revise que OneDrive este sincronizado y que la carpeta se llame exactamente asi.")


def en_entrada(p):
    """El archivo con su carpeta delante ('2026\\Abril\\Reporte diario 01-04-2026.xlsx'): con el reporte
    diario hay Excel que se llaman igual en meses distintos y sin la carpeta no se distinguen."""
    try:
        return str(p.relative_to(config.CARPETA_ENTRADA))
    except (OSError, ValueError):
        return str(p)


def seccion_entrada():
    titulo("2. carpeta de Entrada: que Excel ve el panel (los mismos que usa el correo)")
    try:
        carpetas = config.carpetas_entrada()
        anios = config.anios_carga()
        print(f"  anos que se leen: {', '.join(sorted(anios)) if anios else 'todos'}"
              f"   (se cambia en Backend\\.env con ANIOS_CARGA, o con Utilerias\\ACTUALIZAR.bat 2026)")
        print(f"  carpetas que se leen ({len(carpetas)}):")
        for c in carpetas:
            print(f"     - {c}  {'[existe]' if c.is_dir() else '[NO EXISTE]'}")
        xlsx = config.xlsx_validos()
        print(f"  archivos .xlsx visibles: {len(xlsx)}")
        for p in xlsx:
            meses = [k for k in claves_meses(36) if correo.pertenece(p, k)]
            print(f"     - {en_entrada(p)}"
                  f"  ->  {', '.join(meses) if meses else 'NINGUN MES (ni el nombre ni la carpeta dicen el ano y el mes)'}")
        if not xlsx:
            print("     ninguno: el correo no va a adjuntar nada.")
            return []
        print("  meses recientes y si tienen archivo:")
        for clave in claves_meses(12):
            hits = [en_entrada(p) for p in xlsx if correo.pertenece(p, clave)]
            año, mes = clave.split("-")
            if hits:
                muestra = " | ".join(hits[:3]) + (f"  (+{len(hits) - 3} mas)" if len(hits) > 3 else "")
            else:
                muestra = "- sin archivo -"
            print(f"     {MESES[int(mes) - 1][:3]} {año}: {muestra}")
        return xlsx
    except Exception as e:
        ultimo_error(e)
        return []


def seccion_base():
    titulo("3. base de datos (lo que ya esta cargado y sale en el panel)")
    try:
        if not Path(config.RUTA_BD).exists():
            print(f"  no existe {config.RUTA_BD}  <== abra ABRIR_DASHBOARD.bat")
            return []
        con = sqlite3.connect(f"file:{config.RUTA_BD}?mode=ro", uri=True)
        total = con.execute("SELECT COUNT(*) FROM eventos").fetchone()[0]
        print(f"  eventos totales: {total}")
        meses = con.execute("SELECT substr(hora_inicio,1,7) m, COUNT(*) FROM eventos "
                            "GROUP BY m ORDER BY m DESC LIMIT 15").fetchall()
        print("  meses con eventos (ultimo primero):")
        for m, n in meses:
            print(f"     {m}: {n}")
        print(f"  archivos registrados en cargas: {con.execute('SELECT COUNT(DISTINCT archivo) FROM cargas').fetchone()[0]}")
        con.close()
        return [m for m, _ in meses]
    except Exception as e:
        ultimo_error(e)
        return []


def seccion_salida():
    titulo("4. dashboard generado")
    try:
        html = Path(config.CARPETA_SALIDA) / config.NOMBRE_HTML
        if not html.exists():
            print(f"  no existe {html}  <== abra ABRIR_DASHBOARD.bat")
            return
        m = dt.datetime.fromtimestamp(html.stat().st_mtime)
        print(f"  {html}")
        print(f"  {html.stat().st_size / 1024:.0f} KB, generado el {m:%d/%m/%Y %H:%M}")
    except Exception as e:
        ultimo_error(e)


def sonda_servidor():
    """(puerto_ok, puerto_tomado_sin_dashboard) entre 8765 y 8784 (servidor.PUERTO .. +PUERTOS)."""
    import servidor
    ok = tomado = None
    for p in range(servidor.PUERTO, servidor.PUERTO + servidor.PUERTOS):
        estado = servidor._revisar(p)
        if estado == "ok":
            return p, None
        if estado == "ocupado" and tomado is None:
            tomado = p
    return ok, tomado


def seccion_servidor(meses):
    titulo("5. servidor local (es el que lee la carpeta y abre Outlook)")
    try:
        puerto, tomado = sonda_servidor()
        if puerto is None:
            if tomado:
                print(f"  hay una ventana del servidor en el puerto {tomado} que NO encuentra el dashboard.")
                print("  Cierre esa ventana vieja y abra ABRIR_DASHBOARD.bat (falta el dashboard.html).")
            else:
                print("  NO HAY servidor local corriendo.")
                print("  Sin el, el boton Outlook no puede adjuntar: abra el panel con ABRIR_DASHBOARD.bat.")
                print("  (si abrio el dashboard.html con doble clic, es file:// y nunca va a adjuntar)")
            return
        print(f"  si hay servidor en http://127.0.0.1:{puerto}")
        claves = ",".join(meses[:12]) or ",".join(claves_meses(3))
        with urllib.request.urlopen(f"http://127.0.0.1:{puerto}/adjuntos?meses={claves}", timeout=15) as r:
            j = json.loads(r.read().decode("utf-8"))
        print(f"  /adjuntos contesta con lo mismo que ve el modal:")
        print(f"     carpeta      : {j.get('carpeta')}")
        print(f"     existe       : {'SI' if j.get('carpeta_existe') else 'NO  <== la carpeta no esta en este equipo'}")
        print(f"     adjuntaria   : {', '.join(j.get('adjuntos') or []) or 'nada'}")
        print(f"     sin archivo  : {', '.join(j.get('faltan') or []) or 'ningun mes'}")
    except Exception as e:
        ultimo_error(e)


def seccion_outlook():
    titulo("6. Outlook de escritorio (el que arma el mensaje con diseno y adjuntos)")
    llaves = [r"Software\Microsoft\Windows NT\CurrentVersion\Windows Messaging Subsystem\Profiles",
              r"Software\Microsoft\Office\16.0\Outlook\Profiles"]
    perfiles = 0
    for k in llaves:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, k) as h:
                perfiles += winreg.QueryInfoKey(h)[0]
        except OSError:
            pass
    if perfiles:
        print(f"  perfiles de correo en el registro: {perfiles}  (OK)")
    else:
        print("  NO hay perfil de correo en esta PC.")
        print("  Outlook no puede abrir un mensaje: el panel cae al correo web, que es texto plano.")
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                            r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\outlook.exe") as h:
            ruta = winreg.QueryValue(h, None)
        print(f"  outlook.exe: {ruta}  {'[existe]' if ruta and Path(ruta).exists() else '[NO se encuentra]'}")
    except OSError:
        print("  outlook.exe: no registrado en este equipo (Outlook no esta instalado o es de la Tienda)")
    bitacora = config.ruta_registro("correo.log")
    if bitacora.exists():
        ultimos = [l for l in bitacora.read_text("utf-8", "replace").splitlines() if l.strip()][-3:]
        print("  ultimos intentos del boton Outlook (Registros\\correo.log, al lado de actualizacion.log):")
        for l in ultimos:
            print(f"    {l[:230]}")
    else:
        print("  en esta PC todavia no se intenta enviar; el boton Outlook anota motivo y etapa en Registros\\correo.log")


def veredicto(entrada):
    titulo("7. resumen: que esta bloqueando el correo")
    problemas = []
    if not config.CARPETA_ENTRADA.exists():
        problemas.append("La carpeta de Entrada no existe en este equipo: revise la seccion 1.")
    if not entrada:
        problemas.append("No hay ningun .xlsx visible en Entrada ni en Historial: nada que adjuntar.")
    try:
        puerto, tomado = sonda_servidor()
        if puerto is None:
            problemas.append("No hay servidor local con dashboard: abra el panel con ABRIR_DASHBOARD.bat"
                             + (f" (hay una ventana vieja en el puerto {tomado})." if tomado else "."))
    except Exception:
        pass
    if perfiles_cero():
        problemas.append("Outlook no tiene perfil de correo en esta PC.")
    if not problemas:
        print("  se ve bien: hay Excel visibles, servidor y Outlook con perfil.")
        print("  Pruebe el boton Outlook desde el panel abierto con ABRIR_DASHBOARD.bat.")
    for i, p in enumerate(problemas, 1):
        print(f"  {i}. {p}")


def perfiles_cero():
    for k in [r"Software\Microsoft\Windows NT\CurrentVersion\Windows Messaging Subsystem\Profiles",
              r"Software\Microsoft\Office\16.0\Outlook\Profiles"]:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, k) as h:
                if winreg.QueryInfoKey(h)[0]:
                    return False
        except OSError:
            pass
    return True


def main():
    print("=" * 72)
    print(" DIAGNOSTICO DEL PANEL TAD  -  solo lectura, no cambia nada")
    print("=" * 72)
    print(f"  equipo : {platform.node()}   usuario: {Path.home().name}")
    print(f"  fecha  : {dt.datetime.now():%d/%m/%Y %H:%M}")
    print(f"  python : {sys.executable}")
    print(f"  proyecto: {config.RAIZ}")
    seccion_rutas()
    entrada = seccion_entrada()
    meses = seccion_base()
    seccion_salida()
    seccion_servidor(meses)
    seccion_outlook()
    veredicto(entrada)
    print("\n El informe tambien queda guardado en Registros\\diagnostico.txt (junto a actualizacion.log y correo.log).\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
