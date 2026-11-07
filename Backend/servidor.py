"""Servidor local del dashboard (solo esta PC, 127.0.0.1).
Muestra Salida\\dashboard.html, guarda en la base de datos el estatus (Descartada) y arma el
correo del reporte con los Excel del periodo adjuntos (Outlook de escritorio).
Se inicia con ABRIR_DASHBOARD.bat."""
import base64
import json
import os
import re
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402
import correo  # noqa: E402
import database  # noqa: E402
from reglas_eventos import estatus_panel  # noqa: E402

ESTATUS = {"Descartada", ""}
PROTOCOLO = {"1", ""}          # '1' = palomeado (si); '' = no palomeado (no)
PUERTO = 8765
PUERTOS = 20                 # se prueban 8765..8784: si quedan los 10 de antes, el panel sigue abriendo
MAX_EVENTO = 10_000          # el POST /evento es chico (un id y un motivo)
MAX_CORREO = 8_000_000       # el reporte NO pesa decenas de KB: medido el 2026-11-05, el HTML del /correo
                             # crece ~7 KB por conductor del periodo (276 KB con 8 y 1 MB con 100), asi que
                             # con los 800 KB viejos un reporte de 60+ conductores llegaba cortado a la mitad
                             # y el panel lo leia como "Failed to fetch" sin dejar motivo en el registro.
MAX_SUBIDA = 28_000_000      # el POST /protocolo: el archivo llega en base64 (ocupa 4/3 de su tamano)
MAX_ARCHIVO = 20_000_000     # y ya decodificado, 20 MB por archivo
LISTA_PROTOCOLOS = 400       # cuantos archivos de la carpeta de Protocolo se llegan a listar en el panel


def _nombre_seguro(nombre):
    """Nombre del archivo subido, listo para el disco: sin rutas, sin .., con espacios y acentos.
    Se guarda como <id-del-evento>__<nombre> para que dos eventos no pisquen el mismo archivo."""
    n = os.path.basename(str(nombre or "").replace("\\", "/"))
    n = re.sub(r"[^\w .()\[\]-]", "_", n, flags=re.UNICODE).strip(" .")[:120]
    return n or "archivo"


def _archivo_protocolo(ident):
    """(ruta, error) del archivo de protocolo de un evento. Se busca en las carpetas posibles del .env,
    asi el boton sigue abriendo el archivo aunque esta PC use otra letra o la carpeta de Protocolo
    este en el respaldo local."""
    con = database.conectar()
    try:
        fila = con.execute("SELECT protocolo_arch FROM eventos WHERE id = ?", (ident,)).fetchone()
    finally:
        con.close()
    if not fila or not fila[0]:
        return None, "este evento no tiene archivo de protocolo"
    for p in config.protocolo_posibles():
        try:
            ruta = p / fila[0]
            if ruta.is_file():
                return ruta, None
        except OSError:
            continue
    return None, (f"el archivo {fila[0]} ya no esta en "
                  + " ni en ".join(str(p) for p in config.protocolo_posibles()[:2]))


def _claves(texto):
    """'2026-01,2026-04' -> ['2026-01', '2026-04']. Se descartan las que no tengan forma de mes."""
    return [c for c in re.split(r"[,\s]+", texto or "") if correo.CLAVE.match(c)][:24]

def _etiqueta(p):
    """Nombre del Excel con su carpeta delante ('2026\\Abril\\Reporte diario 01-04-2026.xlsx'), para que
    el modal de adjuntos distinga los reportes diarios que se llaman igual en meses distintos."""
    try:
        return str(p.relative_to(config.CARPETA_ENTRADA))
    except (OSError, ValueError):
        return p.name

# Sin SO_REUSEADDR: Windows permitia que dos servidores escucharan el mismo puerto y las
# peticiones podian acabar en una instancia vieja que no encontraba el dashboard.
class Servidor(HTTPServer):
    allow_reuse_address = False


def _url(puerto):
    return f"http://127.0.0.1:{puerto}/"


def _revisar(puerto):
    """Devuelve ok si en ese puerto ya vive UN servidor de ESTE panel (y entonces se reusa, en lugar de
    abrir otra ventana encima), ocupado si lo tiene otro programa, libre si no contesta nada.
    Se pregunta por /eventos y no por dashboard.html (2026-11-05): al preguntar por el HTML, un servidor
    propio que todavia no tiene dashboard generado contestaba 404, se leia como "ocupado", y con varias
    ventanas asi el .bat cerraba diciendo "no se pudo abrir ningun puerto libre". /eventos es ruta propia
    de este panel y siempre contesta JSON."""
    sin_proxy = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with sin_proxy.open(_url(puerto) + "eventos", timeout=0.7) as r:
            cabecera = (r.headers.get("Content-Type") or "").split(";")[0]
            if r.status == 200 and cabecera == "application/json":
                return "ok"
            return "ocupado"
    except urllib.error.HTTPError:
        return "ocupado"
    except Exception:
        return "libre"


def _sirve_panel(puerto):
    """Si ESE servidor ya alcanza el dashboard (200 text/html en la raiz). Sirve solo para el aviso:
    reusar un servidor sin dashboard esta bien, pero la pantalla va a salir vacia y hay que decir por que."""
    sin_proxy = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with sin_proxy.open(_url(puerto), timeout=1.5) as r:
            return r.status == 200 and "text/html" in (r.headers.get("Content-Type") or "")
    except Exception:
        return False


def _duenos_de_los_puertos(desde, cuantos):
    """Quien tiene tomados los puertos del rango, en palabras ("python.exe (PID 4312)"), para que el aviso
    diga cual ventana cerrar en lugar de "cierre las ventanas del panel". Lee netstat y tasklist, sin matar
    nada: cerrar procesos de esta PC le toca a la persona, no al panel."""
    letreros = []
    try:
        r = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, timeout=10,
                           encoding="utf-8", errors="replace")
    except Exception:
        return letreros
    pids = []
    for linea in (r.stdout or "").splitlines():
        campos = linea.split()
        if len(campos) < 4 or campos[0].upper() != "TCP":
            continue
        try:
            puerto = int(campos[1].rsplit(":", 1)[-1])
        except ValueError:
            continue
        if desde <= puerto < desde + cuantos and campos[3].upper() == "LISTENING":
            pid = campos[-1]
            if pid not in pids:
                pids.append(pid)
    for pid in pids[:6]:
        nombre = ""
        try:
            t = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH", "/FO", "CSV"],
                               capture_output=True, timeout=10, encoding="utf-8", errors="replace")
            primera = next((l for l in (t.stdout or "").splitlines() if l.strip()), "")
            nombre = primera.strip('"').split('","')[0].strip('"')
        except Exception:
            pass
        letreros.append(f"{nombre or 'proceso'} (PID {pid})")
    return letreros


class Manejador(BaseHTTPRequestHandler):
    def _responder(self, codigo, cuerpo, tipo="application/json; charset=utf-8"):
        datos = cuerpo if isinstance(cuerpo, bytes) else json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(datos)
        except ConnectionError:     # el navegador cerro la conexion
            pass

    def _local(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        origen = self.headers.get("Origin")
        return host in ("127.0.0.1", "localhost") and (not origen or origen.split("//")[-1].split(":")[0] in ("127.0.0.1", "localhost"))

    def do_GET(self):
        ruta, _, consulta = self.path.partition("?")
        if not self._local():
            return self._responder(404, {"ok": False, "error": "no encontrado"})
        if ruta == "/eventos":
            # Estatus y motivo tal como estan en la base: el HTML solo trae una foto de cuando se genero.
            con = database.conectar()
            try:
                filas = con.execute("SELECT id, estatus, motivo, protocolo, protocolo_arch FROM eventos "
                                    "WHERE estatus IS NOT NULL OR motivo IS NOT NULL "
                                    "OR protocolo IS NOT NULL OR protocolo_arch IS NOT NULL").fetchall()
            finally:
                con.close()
            # [estatus, motivo, protocolo, tiene archivo, nombre del archivo]. El 4 es 0 si el archivo ya no
            # esta en la carpeta de Protocolo (lo movieron, lo borraron, o esta en el Drive de otra laptop):
            # el boton entonces avisa en lugar de abrir nada, y el 5 le dice a cual nombre estaba apuntando.
            return self._responder(200, {str(i): [estatus_panel(e), m or "", p or "",
                                                  int(config.protocolo_existe(arch)), arch or ""]
                                         for i, e, m, p, arch in filas})
        if ruta == "/adjuntos":
            # Lo que el modal muestra antes de enviar: que Excel caen con los meses del reporte.
            claves = _claves(urllib.parse.parse_qs(consulta).get("meses", [""])[0])
            adjuntos, faltan = correo.archivos_de_meses(claves)
            return self._responder(200, {"ok": True, "carpeta": str(config.CARPETA_ENTRADA),
                                         "carpeta_existe": config.CARPETA_ENTRADA.exists(),
                                         "adjuntos": [_etiqueta(p) for p in adjuntos], "faltan": faltan})
        if ruta == "/reporte-imagen":
            # La imagen del final del reporte, en base64, para que la vista previa del panel y el boton
            # "Copiar con diseño" la muestren. En el correo de Outlook NO viaja en base64: ahi se adjunta
            # el archivo y se referencia con cid:, que es lo que el motor de Word si entiende.
            try:
                imagen, dato = config.imagen_reporte()      # dato = mime si hay imagen, motivo si no
                if not imagen:
                    return self._responder(200, {"ok": False, "error": dato})
                datos = base64.b64encode(imagen.read_bytes()).decode()
            except Exception as e:
                # Cualquier reviento aqui (carpeta inaccesible, archivo que se fue, lectura cortada) tiene
                # que llegar al panel como motivo legible: si no, la ventanica se queda en "buscando…".
                return self._responder(200, {"ok": False, "error": f"{type(e).__name__}: {str(e)[:180]}"})
            return self._responder(200, {"ok": True, "nombre": imagen.name, "mime": dato,
                                         "carpeta": str(imagen.parent),
                                         # los otros nombres que hay ahi: si sale "Pemex.png" y en la lista
                                         # si aparece un "Protocolo...", el servidor es viejo (hay que cerrar
                                         # la ventana negra y volver a abrir el .bat), no la carpeta.
                                         "otras": config.imagenes_cercanas(config.carpeta_imagen(imagen), imagen),
                                         "data": datos})
        if ruta == "/destinatarios":
            # Con quien sale el reporte por defecto: la lista guardada desde el panel, o la del .env.
            para, cc = config.destinatarios()
            return self._responder(200, {"ok": True, "para": para, "cc": cc,
                                         "guardado": config.RUTA_DESTINATARIOS.exists()})
        if ruta == "/abrir-carpeta":
            # Muestra en el Explorador una carpeta del proyecto: la de Entrada (por defecto, para arrastrar
            # el Excel al correo web cuando Outlook de escritorio no abre) o la de Protocolo (?q=protocolo,
            # para dejar alli el documento antes de elegirlo desde el boton "Subir" de la fila).
            if urllib.parse.parse_qs(consulta).get("q", [""])[0] == "protocolo":
                carpeta, error = config.carpeta_protocolo()
                if error:
                    return self._responder(200, {"ok": False, "error": error})
            else:
                carpeta = config.CARPETA_ENTRADA
            if not carpeta.exists():
                return self._responder(200, {"ok": False, "error": f"no existe {carpeta}"})
            os.startfile(str(carpeta))
            return self._responder(200, {"ok": True, "carpeta": str(carpeta)})
        if ruta == "/protocolos":
            # Lo que muestra el boton "Subir": los documentos que ya estan en la carpeta de Protocolo,
            # con el evento al que cada uno apunta, para no subir una copia de algo que ya vive ahi.
            carpeta, error = config.carpeta_protocolo()
            if error:
                return self._responder(200, {"ok": False, "error": error})
            try:
                nombres = sorted((p.name for p in carpeta.iterdir()
                                  if p.is_file() and not p.name.startswith("~$") and p.suffix.lower() != ".tmp"),
                                 key=str.lower)[:LISTA_PROTOCOLOS]
            except OSError as e:
                return self._responder(200, {"ok": False, "error": f"no se pudo leer {carpeta} ({e})"})
            con = database.conectar()
            try:
                uso = {}
                for ident, arch in con.execute("SELECT id, protocolo_arch FROM eventos "
                                               "WHERE protocolo_arch IS NOT NULL AND protocolo_arch <> ''"):
                    uso.setdefault(arch, []).append(ident)
            finally:
                con.close()
            archivos = []
            for n in nombres:
                try:
                    st = (carpeta / n).stat()
                except OSError:      # lo borraron entre el listado y aqui
                    continue
                archivos.append({"n": n, "s": st.st_size, "m": int(st.st_mtime), "ev": uso.get(n, [])[:8]})
            return self._responder(200, {"ok": True, "carpeta": str(carpeta), "archivos": archivos})
        if ruta == "/protocolo":
            # Boton "Consultar" de la fila: abre con Windows el archivo guardado en la carpeta de Protocolo.
            params = urllib.parse.parse_qs(consulta)
            try:
                ident = int(params.get("id", [""])[0])
            except ValueError:
                return self._responder(400, {"ok": False, "error": "id no valido"})
            archivo, error = _archivo_protocolo(ident)
            if error:
                return self._responder(200, {"ok": False, "error": error})
            try:
                os.startfile(str(archivo))
            except OSError as e:
                return self._responder(200, {"ok": False, "error": f"no se pudo abrir {archivo.name} ({e})"})
            return self._responder(200, {"ok": True, "archivo": archivo.name,
                                         "carpeta": str(archivo.parent)})
        if ruta not in ("/", "/dashboard.html", "/index.html"):
            return self._responder(404, {"ok": False, "error": "no encontrado"})
        html = Path(config.CARPETA_SALIDA) / config.NOMBRE_HTML
        if not html.exists():
            return self._responder(404, "Todavia no hay dashboard. Abra ABRIR_DASHBOARD.bat: actualiza y genera el panel.".encode("utf-8"), "text/plain; charset=utf-8")
        self._responder(200, html.read_bytes(), "text/html; charset=utf-8")

    def do_POST(self):
        ruta = self.path.split("?")[0]
        if ruta not in ("/evento", "/protocolo", "/correo", "/destinatarios") or not self._local() or "application/json" not in (self.headers.get("Content-Type") or ""):
            return self._responder(403, {"ok": False, "error": "solicitud no permitida"})
        try:
            largo = int(self.headers.get("Content-Length") or 0)
            limite = {"/correo": MAX_CORREO, "/protocolo": MAX_SUBIDA}.get(ruta, MAX_EVENTO)
            if largo > limite:
                # Se leia min(largo, limite): el cuerpo quedaba TRUNCADO, json.loads reventaba y el
                # navegador se quedaba sin respuesta (el socket se cerraba con datos sin leer) -> el panel
                # reportaba "Failed to fetch" y correo.log no anotaba nada. Aqui se descarta el resto y
                # si hay una respuesta con el tamano real y el motivo.
                self.rfile.read(limite)
                faltan = largo - limite
                while faltan > 0:
                    leido = self.rfile.read(min(faltan, 1_000_000))
                    if not leido:
                        break
                    faltan -= len(leido)
                correo.registrar(f"POST {ruta} grande demais: {largo:,} bytes, limite {limite:,}")
                return self._responder(413, {"ok": False,
                                             "error": f"el mensaje pesa {largo // 1000:,} KB y el tope local es {limite // 1000:,} KB; "
                                                      "achique el periodo (menos meses o un ano) y vuelva a intentar"})
            datos = json.loads(self.rfile.read(largo))
            if not isinstance(datos, dict):
                return self._responder(400, {"ok": False, "error": "datos no validos"})
            if ruta == "/correo":
                return self._correo(datos)
            if ruta == "/destinatarios":
                # El boton "Guardar como predeterminado" de la ventana del correo.
                para = str(datos.get("para") or "")[:2000].strip()
                cc = str(datos.get("cc") or "")[:2000].strip()
                try:
                    config.guarda_destinatarios(para, cc)
                except OSError as e:
                    return self._responder(200, {"ok": False,
                                                 "error": f"la memoria esta de solo lectura y no se pudo guardar ({e})"})
                return self._responder(200, {"ok": True, "para": para, "cc": cc})
            if ruta == "/protocolo":
                return self._sube_protocolo(datos)
            ident = int(datos["id"])
            campos, valores = [], []
            if "estatus" in datos:
                if datos["estatus"] not in ESTATUS:
                    return self._responder(400, {"ok": False, "error": "estatus no valido"})
                campos.append("estatus = ?")
                valores.append(datos["estatus"] or None)
            if "motivo" in datos:
                campos.append("motivo = ?")
                valores.append(str(datos["motivo"]).strip()[:500] or None)
            if "protocolo" in datos:
                if str(datos["protocolo"]) not in PROTOCOLO:
                    return self._responder(400, {"ok": False, "error": "protocolo no valido"})
                campos.append("protocolo = ?")
                valores.append(str(datos["protocolo"]) or None)
            if not campos:
                return self._responder(400, {"ok": False, "error": "nada que guardar"})
            con = database.conectar()
            try:
                con.execute("PRAGMA busy_timeout = 15000")
                n = con.execute(f"UPDATE eventos SET {', '.join(campos)} WHERE id = ?", (*valores, ident)).rowcount
                con.commit()
            finally:
                con.close()
            if not n:
                return self._responder(404, {"ok": False, "error": "evento no encontrado (actualice el dashboard)"})
            self._responder(200, {"ok": True})
        except sqlite3.OperationalError as e:
            self._responder(503, {"ok": False, "error": f"la base esta ocupada, intente de nuevo ({e})"})
        except (KeyError, ValueError, TypeError):
            self._responder(400, {"ok": False, "error": "datos no validos"})
        except Exception as e:
            # Sin esto el error se salia por encima de do_POST: http.server cerraba la conexion SIN
            # contestar nada y el panel lo leia como "no hay servidor local" (paso 2026-11-05: el boton
            # Correo avisaba de abrir el .bat cuando el servidor estaba vivo y lo que habia fallado era
            # PowerShell, la carpeta temporal o el propio correo.py). Ahora siempre hay una respuesta JSON
            # con el motivo real, y queda en el registro.
            correo.registrar(f"POST {ruta} reviento: {type(e).__name__}: {e}")
            self._responder(500, {"ok": False, "error": f"{type(e).__name__}: {str(e)[:180]}"})

    def _sube_protocolo(self, datos):
        """Guarda en la carpeta de Protocolo el archivo elegido en la fila y anota su nombre en el evento.
        Con {id, elegir} no sube nada: solo apunta el evento al archivo que ya esta en esa carpeta.
        El archivo se escribe como <id>__<nombre>: dos eventos de la misma unidad no se pisan.
        Si vuelve a subir el mismo nombre lo reemplaza; con nombre distinto el anterior se queda en la
        carpeta (no se borra nada) y la base pasa a apuntar al nuevo."""
        ident = int(datos["id"])
        if datos.get("elegir"):
            return self._apunta_protocolo(ident, str(datos["elegir"]))
        destino = f"{ident}__{_nombre_seguro(datos.get('nombre'))}"
        contenido = base64.b64decode(str(datos.get("data") or "").split(",")[-1] or "")
        if not contenido:
            return self._responder(400, {"ok": False, "error": "el archivo llego vacio"})
        if len(contenido) > MAX_ARCHIVO:
            return self._responder(400, {"ok": False, "error": f"el archivo pasa de {MAX_ARCHIVO // 1_000_000} MB"})
        carpeta, error = config.carpeta_protocolo()
        if error:
            return self._responder(200, {"ok": False, "error": error})
        con = database.conectar()
        try:
            con.execute("PRAGMA busy_timeout = 15000")
            if not con.execute("SELECT 1 FROM eventos WHERE id = ?", (ident,)).fetchone():
                return self._responder(404, {"ok": False, "error": "evento no encontrado (actualice el dashboard)"})
            (carpeta / destino).write_bytes(contenido)
            con.execute("UPDATE eventos SET protocolo_arch = ? WHERE id = ?", (destino, ident))
            con.commit()
        except OSError as e:
            con.rollback()
            return self._responder(200, {"ok": False, "error": f"no se pudo escribir en {carpeta} ({e})"})
        finally:
            con.close()
        return self._responder(200, {"ok": True, "archivo": destino, "carpeta": str(carpeta)})

    def _apunta_protocolo(self, ident, nombre):
        """El archivo YA esta en la carpeta de Protocolo (lo bajaron del Drive o lo puso otra laptop):
        el evento pasa a apuntar a ese nombre, sin copiar ni mover nada. Se acepta el nombre tal cual,
        sin sanitizar, porque tiene que coincidir con el archivo que esta en el disco; por eso se exige
        que sea un nombre suelto (sin rutas ni '..') y que de verdad exista en alguna de las carpetas."""
        nombre = nombre.strip()
        if not nombre or nombre != os.path.basename(nombre) or ".." in nombre:
            return self._responder(400, {"ok": False, "error": "nombre de archivo no valido"})
        if not config.protocolo_existe(nombre):
            return self._responder(200, {"ok": False,
                                         "error": f"{nombre} ya no esta en la carpeta de Protocolo"})
        con = database.conectar()
        try:
            con.execute("PRAGMA busy_timeout = 15000")
            if not con.execute("SELECT 1 FROM eventos WHERE id = ?", (ident,)).fetchone():
                return self._responder(404, {"ok": False, "error": "evento no encontrado (actualice el dashboard)"})
            con.execute("UPDATE eventos SET protocolo_arch = ? WHERE id = ?", (nombre, ident))
            con.commit()
        except sqlite3.OperationalError as e:
            return self._responder(503, {"ok": False, "error": f"la base esta ocupada, intente de nuevo ({e})"})
        finally:
            con.close()
        donde = next((str(p) for p in config.protocolo_posibles() if (p / nombre).is_file()),
                     str(config.CARPETA_PROTOCOLO))
        return self._responder(200, {"ok": True, "archivo": nombre, "carpeta": donde})

    def _correo(self, datos):
        """El reporte sale a los meses del periodo elegido: se adjuntan sus Excel y Outlook abre el borrador.
        Sin Excel no se renuncia al diseno: Outlook abre igual y el aviso de que falto va en la respuesta."""
        adjuntos, faltan = correo.archivos_de_meses(_claves(",".join(str(m) for m in (datos.get("meses") or []))))
        if faltan:
            correo.registrar(f"sin archivo de {', '.join(faltan)} (se busco en Entrada, sus carpetas de ano y Historial)")
        r = correo.abrir_outlook(str(datos.get("para") or "")[:2000],
                                 str(datos.get("asunto") or "Reporte")[:250],
                                 str(datos.get("texto") or "")[:40_000],
                                 str(datos.get("html") or ""), adjuntos,
                                 cc=str(datos.get("cc") or "")[:2000])
        nombres = [p.name for p in adjuntos]
        # Si el reporte lleva la imagen del final, va en la respuesta para que el panel lo diga en el aviso.
        imagen = correo.cid_de_la_imagen(str(datos.get("html") or ""))
        if not r["ok"] and not adjuntos and not config.CARPETA_ENTRADA.exists():
            r["error"] = f"{r['error']} · y la carpeta de Entrada no existe en este equipo ({config.CARPETA_ENTRADA})"
        self._responder(200, {"ok": r["ok"],
                              "adjuntos": [p for p in nombres if p not in r["sin_adj"]],
                              "sin_adj": r["sin_adj"], "faltan": faltan, "imagen": Path(imagen["ruta"]).name if imagen else "",
                              "error": r["error"]})

    def log_message(self, *args):
        pass


_FB = "48;2;255;255;255"   # el fondo blanco que ya fuerza el boton al abrir la ventana


def _color(txt, code):
    """Pinta solo si hay una pantalla de verdad detras. Cuando la salida esta redirigida
    (los .bat mandan todo a Registros\\*.log) devuelve el texto limpio, para que el log
    no quede lleno de codigos ANSI ilegibles."""
    try:
        if not sys.stdout.isatty():
            return txt
    except Exception:
        return txt
    return f"\x1b[{code};{_FB}m{txt}\x1b[0;{_FB}m"


def _banner(url, avisos):
    """El recuadro que sale debajo del cartel del boton mientras se trabaja en el panel.
    Sin acentos y con try/except en la llamada: si la consola no admite UTF-8 se cae al
    texto plano, porque un error aqui dejaria al servidor sin arrancar."""
    filas = [("Panel", url)] + list(avisos)
    ancho = max([64] + [19 + len(v) + 2 for k, v in filas])
    borde = lambda izq, der: "  " + _color(izq + "═" * ancho + der, "34")
    print()
    print(borde("╔", "╗"))
    print("  " + _color("║", "34") + _color(("  SERVIDOR EN LINEA").ljust(ancho - 2), "1;32")
          + _color("║", "34"))
    print(borde("╠", "╣"))
    for k, v in filas:
        hueco = ancho - 19 - len(v)
        print("  " + _color("║", "34") + "  " + _color(k.ljust(13), "1;30") + _color(" :  ", "34")
              + _color(v, "36") + " " * hueco + _color("║", "34"))
    print(borde("╚", "╝"))


def main():
    viejos = []
    for puerto in range(PUERTO, PUERTO + PUERTOS):
        estado = _revisar(puerto)
        if estado == "ok":
            print("  " + _color("▶  El panel ya esta abierto en " + _url(puerto), "1;32"))
            if not _sirve_panel(puerto):
                print("  " + _color("   OJO: ese servidor esta vivo pero todavia no encuentra el dashboard.", "33"))
                print("   " + _color("   Corra Utilerias\\ACTUALIZAR.bat para generarlo y recargue esta pagina (F5).", "33"))
            print("  " + _color("   Si en el Backend cambio algo desde que esa ventana abrio (config.py, servidor.py,", "33"))
            print("   " + _color("   correo.py), este panel sigue con el codigo viejo: cierre ESA ventana negra y vuelva", "33"))
            print("   " + _color("   a dar doble clic a este .bat. El .bat no cierra servidores por su cuenta.", "33"))
            webbrowser.open(_url(puerto))
            return 0
        if estado == "ocupado":
            viejos.append(puerto)

    servidor, puerto = None, PUERTO
    for puerto in range(PUERTO, PUERTO + PUERTOS):
        try:
            servidor = Servidor(("127.0.0.1", puerto), Manejador)
            break
        except OSError:
            continue
    if servidor is None:
        print("  " + _color(f"✖  Ningun puerto del {PUERTO} al {PUERTO + PUERTOS - 1} se pudo abrir.", "1;31"))
        duenos = _duenos_de_los_puertos(PUERTO, PUERTOS)
        if duenos:
            print("  " + _color("   Se los reparten: " + ", ".join(duenos), "31"))
            print("  " + _color("   Si alguno es python.exe, es una ventana del panel que se quedó colgada:", "33"))
            print("   " + _color("   cierre esa ventana (o, si ya no hay ninguna, acabe esos procesos desde el", "33"))
            print("   " + _color("   Administrador de tareas) y vuelva a dar clic en ABRIR_DASHBOARD.bat.", "33"))
            print("   " + _color("   El panel NO cierra programas por su cuenta.", "33"))
        else:
            print("  " + _color("   Cierre las ventanas del panel que esten abiertas y vuelva a intentar.", "31"))
        return 1
    if viejos:
        print("  " + _color(f"!  {len(viejos)} puerto(s) del {PUERTO}-{PUERTO + PUERTOS - 1} los tenia otra cosa; "
                            f"este panel abrio en el {puerto}.", "35"))
    url = _url(puerto)
    try:
        _banner(url, [("Guarda", "estatus y motivo, en la base de datos"),
                      ("Al cerrar", "se apaga el servidor: guarde antes")])
    except Exception:
        print(f"Dashboard editable en {url}\nLos cambios de estatus y motivo se guardan en la base de datos.\nDeje esta ventana abierta mientras trabaja; cierrela para terminar.")
    webbrowser.open(url)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
