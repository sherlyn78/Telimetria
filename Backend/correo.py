r"""Correo del reporte: busca los Excel del periodo en la carpeta de Entrada (tambien en sus carpetas
de ano y de mes, Entrada\2026\Abril, y en Historial; ver config.xlsx_validos) y abre el mensaje en Outlook.
Lo usa nada mas Backend\servidor.py (esta PC). El navegador no puede adjuntar archivos por si solo,
por eso el panel le pasa al servidor los meses elegidos y aqui se resuelven contra config.CARPETA_ENTRADA."""
import json
import re
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

import config
from reglas_eventos import sin_acentos

LOG = config.ruta_registro("correo.log")


def registrar(texto):
    """Deja en Registros\\correo.log (al lado de actualizacion.log) el resultado de cada intento de enviar.
    Sirve para contestar "por que no adjunto" sin adivinar: aqui queda la etapa y el motivo.
    Nunca falla el envio por culpa del registro."""
    try:
        if LOG.exists() and LOG.stat().st_size > 400_000:      # el USB no se llena de log
            LOG.write_text(LOG.read_text("utf-8", "replace")[-120_000:], encoding="utf-8")
        with LOG.open("a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%d/%m/%Y %H:%M}  {texto}\n")
    except Exception:
        pass

MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
             "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
CLAVE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")          # '2026-04' = abril 2026


def xlsx_entrada():
    """Los .xlsx que se pueden adjuntar: los de Entrada, los de sus carpetas de ano y mes
    (Entrada\\2026\\Abril) y los de Historial (config.xlsx_validos los pone en ese orden). Sin ~$."""
    return config.xlsx_validos()


def coincide(nombre, clave):
    """'2026-04' pega con 'Traffilog Abril 2026.xlsx' y con 'OnCommand Abr 26.xlsx'.
    Acepta el mes por sus primeras 3 letras (long o corto) y el ano de 4 o 2 digitos sueltos."""
    if not CLAVE.match(clave):
        return False
    anio, mes = clave.split("-")
    base = sin_acentos(nombre).lower()
    if MES_LARGO[int(mes) - 1][:3] not in base:
        return False
    return anio in base or re.search(r"(?<!\d)" + anio[2:] + r"(?!\d)", base) is not None


def clave_de_carpeta(ruta):
    """El mes que dice la carpeta donde esta el archivo: 'Entrada\\2026\\Abril\\reporte diario.xlsx'
    es '2026-04'. Con el reporte diario el nombre del archivo ya no lleva el mes, pero la carpeta
    si; asi el correo sigue sabiendo que adjuntar. None si la ruta no dice ano y mes."""
    partes = list(Path(ruta).parts[:-1])          # sin contar el nombre del archivo
    anio = next((p for p in reversed(partes) if re.fullmatch(r"20\d{2}", p)), None)
    if not anio:
        return None
    for p in reversed(partes):
        nombre = sin_acentos(p).strip().lower()
        for i, m in enumerate(MES_LARGO):
            if nombre.startswith(m[:3]):
                return f"{anio}-{i + 1:02d}"
    return None


def pertenece(ruta, clave):
    """Si un Excel cae en el mes 'AAAA-MM': por lo que dice su nombre (como siempre) o por la carpeta
    donde esta guardado. Se usan las dos cosas para no perder ningun archivo del periodo."""
    return coincide(Path(ruta).name, clave) or clave_de_carpeta(ruta) == clave


def archivos_de_meses(claves):
    """claves ['2026-01', ...] -> (archivos a adjuntar, meses que no tienen archivo)."""
    xlsx = xlsx_entrada()
    elegidos, faltan = [], []
    for clave in claves:
        hits = [p for p in xlsx if pertenece(p, clave)]
        if hits:
            elegidos += [p for p in hits if p not in elegidos]
        else:
            faltan.append(clave)
    return elegidos, faltan


_POWERSHELL = r"""
param([string]$Datos)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
# Cada error sale con la etapa donde se rompio (perfil / datos / Outlook / mensaje / ventana),
# para que "no abrio Outlook" o "no adjunto" se pueda explicar sin tener que adivinar.
function Reventar($etapa, $motivo) {
    Write-Output ('ERROR|' + $etapa + '|' + (($motivo -replace '[|\r\n]+', ' ')))
    exit
}
# Sin perfil de correo, CreateItem() de Outlook se queda esperando para siempre: se avisa y se sale ya.
$perfiles = 0
foreach ($rk in @('HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows Messaging Subsystem\Profiles',
                  'HKCU:\Software\Microsoft\Office\16.0\Outlook\Profiles')) {
  if (Test-Path $rk) { $perfiles += @(Get-ChildItem $rk -ErrorAction SilentlyContinue).Count }
}
if ($perfiles -eq 0) {
  Reventar 'perfil' 'esta PC no tiene ninguna cuenta en el Outlook de escritorio: no hay donde armar el mensaje y por eso salio el correo web (que no adjunta y manda texto plano). Cierre sesion y vuelva a entrar en el Outlook de escritorio, o pida a TI que configure la cuenta.'
}
try {
  $d = Get-Content -LiteralPath $Datos -Raw -Encoding UTF8 | ConvertFrom-Json
} catch { Reventar 'datos' ('el mensaje armado por el panel no se pudo leer: ' + $_.Exception.Message) }
try {
  $o = New-Object -ComObject Outlook.Application
} catch {
  Reventar 'Outlook' ('no se pudo iniciar el Outlook de escritorio: ' + $_.Exception.Message + ' (si estan usando el Outlook "nuevo" de la Tienda, ese no admite automacion: hay que abrir el Outlook de siempre y desactivar el interruptor de "nuevo Outlook")')
}
$ver = 'Outlook sin version'
try { $ver = 'Outlook ' + $o.Version } catch { }
try {
  $m = $o.CreateItem(0)
  $m.To = $d.para
  # La copia se pone solo si trae algo: un Cc vacio deja en Outlook el campo marcado como sin resolver.
  if ($d.cc) { $m.Cc = $d.cc }
  $m.Subject = $d.asunto
  if ($d.html) { $m.HTMLBody = $d.html } else { $m.Body = $d.texto }
} catch {
  Reventar 'mensaje' ('Outlook esta abierto pero no dejo crear el mensaje: ' + $_.Exception.Message + ' (suele ser una ventana de Outlook pidiendo algo, o la sesion de Microsoft caida)')
}
# Cada Excel se copia primero a esta carpeta temporal: OneDrive deja el archivo en la nube y Outlook no lo
# lee de ahi, y si esta abierto en Excel la copia tampoco falla. Un archivo malo no debe tumbar el mensaje.
$ok = 0
$mal = @()
$tmp = Join-Path (Split-Path -Parent $Datos) 'adj'
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$cidRuta = ''
$cidValor = ''
try { if ($d.cid) { $cidRuta = [string]$d.cid.ruta; $cidValor = [string]$d.cid.valor } } catch { }
foreach ($a in @($d.adjuntos)) {
  if (-not $a) { continue }
  $nom = [IO.Path]::GetFileName($a)
  try {
    $c = Join-Path $tmp $nom
    Copy-Item -LiteralPath $a -Destination $c -Force -ErrorAction Stop   # sin Stop, un error de Copy-Item no entra al catch
    $at = $m.Attachments.Add($c)
    if ($cidValor -and ($a -eq $cidRuta)) {
      # Content-ID (proptag 0x3712001F): es lo que une el <img src="cid:..."> del cuerpo con ESTE archivo,
      # para que Outlook pinte la imagen al final del reporte SIN dejar de mostrarla como adjunto.
      try { $at.PropertyAccessor.SetProperty('http://schemas.microsoft.com/mapi/proptag/0x3712001F', $cidValor) }
      catch { $mal += (($nom + ': se adjunto pero Outlook no le puso la referencia interna, la imagen puede salir como recuadro en el cuerpo') -replace '[|;]+', ' / ') }
    }
    $ok++
  } catch {
    $q = [string]$_.Exception.Message
    if (-not (Test-Path -LiteralPath $a)) {
      $q = 'ya no esta en la carpeta de Entrada en esta PC'
    } else {
      try { if ((Get-Item -LiteralPath $a).Attributes -match 'RecallOnDataAccess') { $q = 'esta SOLO EN LA NUBE (OneDrive sin descargar): ' + $q } } catch { }
    }
    $mal += (($nom + ': ' + $q) -replace '[|;]+', ' / ')
  }
}
try { $m.Display() } catch { Reventar 'ventana' ('el mensaje estaba listo pero Outlook no lo mostro en pantalla: ' + $_.Exception.Message) }
Write-Output ('OK|' + $ok + '|' + ($mal -join ';') + '|' + $ver)
"""


def documento(html):
    """Outlook usa el motor de Word: sin el envoltorio con su charset, las tildes salen raras."""
    cuerpo = (html or "").strip()
    if not cuerpo or "<body" in cuerpo[:400].lower():
        return cuerpo
    return ('<!DOCTYPE html><html><head>'
            '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">'
            '<meta charset="utf-8"><title>Reporte</title></head>'
            '<body style="margin:0;padding:12px;background:#ffffff">' + cuerpo + '</body></html>')


CID_IMAGEN = "tad-imagen-reporte"


def cid_de_la_imagen(html):
    """La imagen del final del reporte, lista para adjuntarse con Content-ID.
    El panel ya escribe en el HTML src="cid:tad-imagen-reporte"; Word (el motor de Outlook) muestra la
    imagen si ese cid coincide con el de un adjunto, y como no se oculta el adjunto, el archivo tambien
    queda visible en la lista de adjuntos del mensaje, que es lo que se pidio.
    Devuelve {"ruta":..., "valor":...} o None si el reporte no lleva la imagen o no hay archivo."""
    if not html or ("cid:" + CID_IMAGEN) not in html.lower():
        return None
    imagen, _ = config.imagen_reporte()
    return None if not imagen else {"ruta": str(imagen), "valor": CID_IMAGEN}


def abrir_outlook(para, asunto, texto, html, adjuntos, cc=""):
    """Abre el borrador en el Outlook de escritorio con los Excel pegados.

    Devuelve {"ok", "adjuntos" (cuantos entraron), "sin_adj" (nombres que fallaron), "error"}."""
    cuerpo = documento(html)
    cid = cid_de_la_imagen(cuerpo)          # None si el reporte no lleva imagen o esta ya no esta en la carpeta
    lista = [str(p) for p in adjuntos]
    if cid and cid["ruta"] not in lista:
        lista.append(cid["ruta"])           # la imagen viaja como un adjunto mas, pero con Content-ID
    datos = {"para": para, "cc": cc or "", "asunto": asunto, "texto": texto, "html": cuerpo,
             "adjuntos": lista, "cid": cid}
    pila = Path(tempfile.mkdtemp(prefix="correo_tad_"))
    try:
        js = pila / "correo.json"
        ps = pila / "correo.ps1"
        js.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
        ps.write_text(_POWERSHELL, encoding="utf-8")
        r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                            "-File", str(ps), "-Datos", str(js)],
                           capture_output=True, timeout=90, encoding="utf-8", errors="replace")
        lineas = [l for l in (r.stdout or "").splitlines() if l.strip()]
        respuesta = lineas[-1] if lineas else (r.stderr or "PowerShell no respondio").strip()[:200]
        buscados = ", ".join(p.name for p in adjuntos) or "ningun Excel de ese periodo"
        campos = respuesta.split("|")
        if campos[0] != "OK":
            # se quita el "ERROR|" y la etapa para que el aviso del panel se lea limpio
            etapa = campos[1] if len(campos) > 1 else ""
            detalle = " ".join(campos[2:]).strip() if len(campos) > 2 else ""
            aviso = (detalle or etapa or "Outlook no respondio").strip()
            registrar(f"para={para[:120]} | buscados: {buscados} | NO abrio Outlook"
                      + (f" ({etapa})" if detalle else "") + f": {aviso}")
            return {"ok": False, "adjuntos": 0, "sin_adj": [], "error": aviso}
        sin_adj = [x.strip() for x in (campos[2].split(";") if len(campos) > 2 and campos[2] else []) if x.strip()]
        try:
            n = int(campos[1])
        except (IndexError, ValueError):
            n = 0
        version = campos[3].strip() if len(campos) > 3 else ""
        registrar(f"para={para[:120]} | {version} | buscados: {buscados} | entraron {n}"
                  + (f" | no entraron: {' · '.join(sin_adj)}" if sin_adj else "")
                  + ("" if (n or not sin_adj) else " (ningun adjunto)"))
        return {"ok": True, "adjuntos": n, "sin_adj": sin_adj, "error": ""}
    except subprocess.TimeoutExpired:                              # Outlook tuvo 90 s sin contestar
        aviso = ("Outlook tardo mas de 90 segundos en responder: tiene una ventana pidiendo algo "
                 "(aviso de cuenta, "
                 "\"el Outlook se esta reparando\", o la sesion de Microsoft caida). Cierre Outlook "
                 "completamente, abralo a mano, entre a su correo y vuelva a intentar.")
        registrar(f"para={para[:120]} | SIN RESPUESTA en 90 s")
        return {"ok": False, "adjuntos": 0, "sin_adj": [], "error": aviso}
    except Exception as e:                                        # sin Outlook, sin permisos o timeout
        registrar(f"para={para[:120]} | el intento ni siquiera llego a Outlook: {str(e)[:200]}")
        return {"ok": False, "adjuntos": 0, "sin_adj": [], "error": str(e)[:200]}
    finally:
        shutil.rmtree(pila, ignore_errors=True)
