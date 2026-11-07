# Interfaz del actualizador: fondo blanco, tarjeta para elegir anos, barra de progreso y resumen.
# Lo abre ABRIR_DASHBOARD.bat (el boton unico, con -Revisar -SinAbrir: actualiza y luego abre el panel),
# Utilerias\ACTUALIZAR.bat (a mano, preguntando el ano) y ACTUALIZAR_AUTO.bat por la tarea diaria (con -Auto).
param([string]$Py = 'python', [string]$Anios = '', [switch]$Auto, [switch]$Revisar, [switch]$SinAbrir)

# En modo automatico siempre se revisa primero si hay Excel nuevos
if ($Auto) { $Revisar = $true }

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:PYTHONUNBUFFERED = '1'
$env:PYTHONIOENCODING = 'utf-8'

# Registros\: ahi van actualizacion.log, correo.log, diagnostico.txt y tiempos.log. La raiz del proyecto
# se deja solo con los botones. Si la USB esta de solo lectura, se sigue escribiendo en la raiz.
$dirReg = Join-Path $root 'Registros'
try { if (-not (Test-Path $dirReg)) { New-Item -ItemType Directory -Path $dirReg | Out-Null } } catch { $dirReg = $root }
$logReg = Join-Path $dirReg 'actualizacion.log'

$W = 70
$ui = $Host.UI.RawUI
$bgOrig = $ui.BackgroundColor
$fgOrig = $ui.ForegroundColor
$reloj = [Diagnostics.Stopwatch]::StartNew()

# ---------- utilidades ----------
function Leer($f) {
    try {
        $fs = [IO.File]::Open($f, 'Open', 'Read', 'ReadWrite')
        $sr = New-Object IO.StreamReader($fs, [Text.Encoding]::UTF8)
        $t = $sr.ReadToEnd(); $sr.Close(); return $t
    } catch { return '' }
}

function Banda($texto, $bg) {
    Write-Host '  ' -NoNewline
    Write-Host (('   ' + $texto).PadRight($W)) -BackgroundColor $bg -ForegroundColor White
}
function Encabezado($texto, $bg) {
    if ($Auto) { Write-Host "== $texto =="; return }
    Write-Host ''
    Banda '' $bg; Banda $texto $bg; Banda '' $bg
}
function Info($t) {
    if ($Auto) { Write-Host "   $t"; return }
    Write-Host "         · $t" -ForegroundColor DarkGray
}
function Aviso($t) {
    if ($Auto) { Write-Host "   AVISO: $t"; return }
    Write-Host "         ! $t" -ForegroundColor DarkYellow
}

# El dashboard se abre con el servidor local: es la unica manera de que lo marcado en pantalla
# (Descartada y motivo) quede escrito en la base de datos. Si el servidor no arranca, se abre el archivo.
# Con -SinAbrir el que abre el panel es el .bat (ABRIR_DASHBOARD.bat), no hay que lanzar una segunda ventana.
function AbrirDashboard($ruta) {
    if ($SinAbrir) { return }
    $srv = Join-Path $PSScriptRoot 'servidor.py'
    if (Test-Path $srv) {
        try { Start-Process -FilePath $Py -ArgumentList "`"$srv`"" -WorkingDirectory $root; return } catch { }
    }
    Start-Process $ruta
}

function Barra($pct, $etapa, $n) {
    $pct = [math]::Max(0, [math]::Min(100, [int]$pct))
    $largo = 28
    $ll = [int][math]::Round($largo * $pct / 100)
    $e = $etapa
    if ($e.Length -gt 30) { $e = $e.Substring(0, 27) + '...' }
    $e = $e.PadRight(30)
    Write-Host "`r  [$n/3] " -NoNewline -ForegroundColor DarkBlue
    Write-Host ('█' * $ll) -NoNewline -ForegroundColor DarkGreen
    Write-Host ('░' * ($largo - $ll)) -NoNewline -ForegroundColor Gray
    Write-Host (' {0,3}%  ' -f $pct) -NoNewline -ForegroundColor Black
    Write-Host $e -NoNewline -ForegroundColor DarkGray
}

# Ejecuta un script de Python ocultando su salida; mueve la barra entre $ini y $fin
function Paso($n, $titulo, $script, $ini, $fin, $totalArch) {
    $out = Join-Path $env:TEMP "pemex_paso$n.out"
    $err = Join-Path $env:TEMP "pemex_paso$n.err"
    Remove-Item $out, $err -ErrorAction SilentlyContinue
    if ($Auto) { Write-Host "[$n/3] $titulo ..." }
    else { Barra $ini $titulo $n }

    $p = Start-Process -FilePath $Py -ArgumentList @('-u', ('"{0}"' -f $script)) `
        -WorkingDirectory $root -NoNewWindow -PassThru `
        -RedirectStandardOutput $out -RedirectStandardError $err
    $null = $p.Handle
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $etapa = $titulo
    while (-not $p.HasExited) {
        $parcial = Leer $out
        if ($n -eq 2 -and $totalArch -gt 0) {
            $hechos = [regex]::Matches($parcial, '(?m)^.+?\.xlsx:').Count
            $f = [math]::Min(0.98, $hechos / $totalArch)
            $m = [regex]::Matches($parcial, '(?m)^(.+?\.xlsx):')
            if ($m.Count -gt 0) { $etapa = 'Cargado: ' + $m[$m.Count - 1].Groups[1].Value }
        } else {
            $f = 0.97 * (1 - [math]::Exp(-$sw.Elapsed.TotalSeconds / 10))
        }
        if (-not $Auto) { Barra ($ini + ($fin - $ini) * $f) $etapa $n }
        Start-Sleep -Milliseconds 150
    }
    $p.WaitForExit()
    $texto = (Leer $out) + (Leer $err)
    $seg = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    if ($Auto) { Write-Host $texto }
    if ($p.ExitCode -ne 0) {
        if (-not $Auto) { Write-Host '' }
        return @{ Ok = $false; Texto = $texto; Seg = $seg; Etapa = $titulo }
    }
    if (-not $Auto) {
        Barra $fin $titulo $n
        Write-Host ' OK' -ForegroundColor DarkGreen
    }
    return @{ Ok = $true; Texto = $texto; Seg = $seg; Etapa = $titulo }
}

# Cuanto tardo cada etapa. Se anota en Registros\tiempos.log (con -Auto) y en pantalla para poder
# comparar despues de un cambio: sin numeros no se sabe si leer los Excel o generar el panel es lo lento.
function Medir($r, $clave) {
    if ($null -eq $r -or -not $r.ContainsKey('Seg')) { return }
    $script:medidas += ('{0}={1}s' -f $clave, $r.Seg)
    Info ('tiempo de ' + $clave + ': ' + $r.Seg + ' s')
}
$medidas = @()

function Fallo($texto) {
    Encabezado 'ALGO FALLÓ  -  el dashboard NO se actualizó' 'DarkRed'
    Write-Host ''
    Write-Host '  Detalle técnico (envíe una captura de esta pantalla a soporte):' -ForegroundColor Black
    $lineas = ($texto -split "`r?`n") | Where-Object { $_.Trim() -ne '' } | Select-Object -Last 25
    foreach ($l in $lineas) { Write-Host "   $l" -ForegroundColor DarkRed }
    Write-Host ''
    # -SinAbrir: quien sigue es el .bat, que borra la pantalla para imprimir su banner. Se guarda el detalle en el log.
    if ($SinAbrir) {
        try {
            Add-Content -Path $logReg -Value (("===== {0}  FALLO AL ACTUALIZAR (panel editable) =====`r`n" -f (Get-Date)) + ($lineas -join "`r`n")) -Encoding UTF8
            Write-Host '  El detalle tecnico quedo guardado en Registros\actualizacion.log' -ForegroundColor DarkGray
        } catch { }
        return
    }
    if (-not $Auto) { Read-Host '  Presione Enter para cerrar' | Out-Null }
}

# ---------- Tarjeta PASO DE CARGA ----------
# Es la pantalla donde se eligen los anos, en la misma caja de colores que el resto del actualizador.
# Los anos salen de las carpetas de 4 digitos debajo de Entrada y debajo de Entrada\Historial, que es
# exactamente la regla de config.carpetas_entrada(): la tarjeta muestra lo que de verdad se puede leer.
# Si la USB no esta o Python no responde, sale solo "Todos"; elegir nunca puede dejar el panel sin datos.
function AniosDeEntrada {
    $sale = @()
    try {
        $bases = @(& $Py -c "import sys; sys.path.insert(0,'Backend'); import config; print(config.CARPETA_ENTRADA); print(config.CARPETA_HISTORIAL)")
        foreach ($b in $bases) {
            $b = ('' + $b).Trim()
            if (-not $b -or -not (Test-Path $b)) { continue }
            foreach ($c in @(Get-ChildItem $b -Directory -ErrorAction SilentlyContinue)) {
                if ($c.Name -match '^\d{4}$') { $sale += $c.Name }
            }
        }
    } catch { }
    return @($sale | Sort-Object -Unique)
}

# Dibuja la tarjeta y devuelve lo que hay que poner en ANIOS_CARGA ('' = todos, o sea Backend\.env).
# Nada aqui puede dejar a alguien esperando: Enter sigue siendo "todos" y lo que no se entiende tambien.
function CajaAnios {
    $ancho = 66
    $anos = AniosDeEntrada
    $raya = '─' * $ancho

    # Fila de la caja: borde azul, letra con el color pedido, recortada si no cabe.
    function Fila($txt, $fg) {
        $t = ('' + $txt).TrimEnd()
        if ($t.Length -gt ($ancho - 2)) { $t = $t.Substring(0, $ancho - 5) + '...' }
        Write-Host '  ║' -NoNewline -ForegroundColor DarkBlue
        Write-Host (' ' + $t.PadRight($ancho - 2) + ' ') -NoNewline -ForegroundColor $fg
        Write-Host '║' -ForegroundColor DarkBlue
    }

    Write-Host ''
    Write-Host ('  ╔' + $raya + '╗') -ForegroundColor DarkBlue
    Fila 'PASO DE CARGA   ·   ¿Qué años quiere cargar?' 'DarkGreen'
    Fila '' 'Black'

    # Opciones: [1] siempre es Todos; despues un numero por cada ano que existe en Entrada.
    $chips = @('[1] Todos')
    $n = 2
    foreach ($a in $anos) { $chips += ('[' + $n + '] ' + $a); $n = $n + 1 }
    $linea = ''
    foreach ($c in $chips) {
        if (-not $linea) { $linea = $c }
        elseif (($linea.Length + 3 + $c.Length) -le ($ancho - 4)) { $linea += ('   ' + $c) }
        else { Fila $linea 'Black'; $linea = $c }
    }
    Fila $linea 'Black'
    Fila '' 'Black'

    if ($anos.Count) {
        Fila 'Escriba el número, o los años con coma: 2026,2027' 'DarkGray'
    } else {
        Fila 'No se ve ningún año en Entrada: escriba usted los años.' 'DarkGray'
        Fila 'Ejemplo: 2026   o   2026,2027' 'DarkGray'
    }
    Fila 'No borra nada: lo demás sigue en la base y en el panel.' 'DarkGray'
    Fila '' 'Black'

    # El boton verde del mockup: en la consola es la banda de ENTER.
    $boton = '  Cargar TODOS los años  ·  presione ENTER  '
    $pad = [int][math]::Floor(($ancho - $boton.Length) / 2)
    Write-Host '  ║' -NoNewline -ForegroundColor DarkBlue
    Write-Host (' ' * $pad) -NoNewline
    Write-Host $boton -NoNewline -BackgroundColor DarkGreen -ForegroundColor White
    Write-Host (' ' * ($ancho - $pad - $boton.Length)) -NoNewline
    Write-Host '║' -ForegroundColor DarkBlue
    Fila '' 'Black'
    Write-Host ('  ╚' + $raya + '╝') -ForegroundColor DarkBlue
    Write-Host ''

    Write-Host '  Respuesta  ' -NoNewline -ForegroundColor Black
    Write-Host '[ENTER = todos]  >  ' -NoNewline -ForegroundColor DarkGray
    $resp = ('' + (Read-Host)).Trim()
    if ($resp -match '(?i)^(todos|all|\*)') { return '' }
    $partes = @($resp -split '[,; +]+' | Where-Object { $_ -match '^\d+$' })
    $sale = @()
    foreach ($p in $partes) {
        if ($p.Length -eq 4) { $sale += $p; continue }
        $k = [int]$p
        if ($k -le 1) { return '' }
        if (($k - 2) -lt $anos.Count) { $sale += $anos[$k - 2] }
    }
    if ($sale.Count) { return (@($sale | Sort-Object -Unique) -join ',') }
    if ($resp) { Aviso 'No se entendió la respuesta: se cargan TODOS los años (que es lo normal).' }
    return ''
}

# ---------- pantalla ----------
$codigo = 0
try {
    if (-not $Auto) {
        $ui.BackgroundColor = 'White'; $ui.ForegroundColor = 'Black'
        # Windows Terminal no obedece el "color F0" del .bat: sin esto la ventana queda negra
        # y las letras negras (Barra, avisos) no se ven. OSC 10/11 pone el fondo blanco real.
        [Console]::Write([char]27 + ']10;rgb:0000/0000/0000' + [char]27 + '\')
        [Console]::Write([char]27 + ']11;rgb:ffff/ffff/ffff' + [char]27 + '\')
        Clear-Host
        # y borra otra vez con el fondo blanco ya puesto, para que no queden manchas negras
        [Console]::Write([char]27 + '[48;2;255;255;255m' + [char]27 + '[2J' + [char]27 + '[H')
    }
    Encabezado 'PEMEX ALERTAS   |   Monitor de conducción en TAD' 'DarkBlue'
    Write-Host ''
    Write-Host '  Se cargan los Excel nuevos y se actualiza el dashboard.' -ForegroundColor Black
    Write-Host '  Tarda un par de minutos. ' -NoNewline -ForegroundColor Black
    Write-Host 'No cierre esta ventana.' -ForegroundColor DarkYellow
    Write-Host ''

    # Python
    try { & $Py --version | Out-Null; if ($LASTEXITCODE -ne 0) { throw 'py' } }
    catch {
        Fallo 'No se pudo ejecutar Python. Detenerse aquí y avisar a TI.'
        exit 10
    }

    # Que anos se leen de Entrada. config.anios_carga() mira primero esta variable y despues
    # ANIOS_CARGA en Backend\.env; si no se pone nada, se cargan todos. Con -Anios lo pasa el .bat
    # (Utilerias\ACTUALIZAR.bat 2026) y no se pregunta. Solo la tarea diaria (-Auto) se salta la
    # tarjeta: no hay nadie enfrente. En los demas casos sale la caja PASO DE CARGA.
    if ($Anios) { $env:ANIOS_CARGA = $Anios }
    elseif (-not $Auto) {
        $elige = CajaAnios
        if ($elige) { $env:ANIOS_CARGA = $elige }
    }

    # Carpeta Entrada y ruta del dashboard (respetan lo que diga Backend\.env)
    $ent = $null; $htmlPath = Join-Path $root 'Salida\dashboard.html'; $totalArch = 0; $firma = ''; $qAnios = 'todos'
    try {
        # La lista de Excel la pone config.xlsx_validos: es la misma que leen la carga y el correo
        # (Entrada, sus carpetas de ano y Historial). Si se contara aqui otra cosa, el "todo al dia" mentiria.
        # La firma se imprime AL FINAL: sin Excel queda una linea vacia y, si PowerShell la suelta,
        # lo unico que se pierde es la firma (que es justo el caso "no hay nada que cargar").
        $info = @(& $Py -c "import sys; sys.path.insert(0,'Backend'); import config; v=config.xlsx_validos(); a=config.anios_carga(); print(config.CARPETA_ENTRADA); print(config.CARPETA_SALIDA / config.NOMBRE_HTML); print(','.join(sorted(a)) if a else 'todos'); print(';'.join('%s|%s|%s' % (p.name, p.stat().st_size, round(p.stat().st_mtime)) for p in v))")
        if ($info.Count -ge 3) {
            $ent = $info[0]; $htmlPath = $info[1]; $qAnios = $info[2]
            $firma = ($info | Select-Object -Skip 3) -join ';'
            $totalArch = @($firma.Split(';', [StringSplitOptions]::RemoveEmptyEntries)).Count
        }
        Info ('Años a cargar: ' + $qAnios + '   |   Excel a revisar: ' + $totalArch)
    } catch { $totalArch = 0; $firma = '' }

    # "Firma" de los Excel (nombre + tamano + fecha): si no cambió desde la última vez, no hay nada nuevo.
    # Pero la firma solo mira los Excel: si ademas se cambio el codigo del panel (Frontend\src o el
    # generador) y el dashboard.html es mas viejo que ese codigo, hay que regenerar si o si; si no,
    # el boton decia "Todo al dia" y la gente seguia usando un panel viejo (sin diseno ni adjuntos).
    # 2026-11-05: esto se calcula ANTES del caso "no hay Excel" porque si no, en la laptop donde no se
    # ve la Entrada el boton salia por el 20 sin regenerar nada y el panel seguia con el codigo viejo.
    $archivoFirma = Join-Path $dirReg 'ultima_firma_entrada.txt'
    $fuente = $null
    foreach ($d in @('Frontend\src', 'Backend\generador')) {
        if (-not (Test-Path $d)) { continue }
        foreach ($x in @(Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue)) {
            if (-not $fuente -or $x.LastWriteTimeUtc -gt $fuente) { $fuente = $x.LastWriteTimeUtc }
        }
    }
    $codeViejo = [bool]($fuente -and (Test-Path $htmlPath) -and ((Get-Item $htmlPath).LastWriteTimeUtc -lt $fuente))
    $sinPanel = [bool](-not (Test-Path $htmlPath))

    # -SinAbrir (panel editable): si no hay ni un Excel legible no hay nada que cargar, y suelta un "ALGO FALLÓ"
    # que asusta sin razón. Se sale en paz (codigo 20) y el .bat abre el panel con lo que ya hay en la base.
    # Excepcion: si el dashboard esta viejo o no existe, se corre SOLO el generador (etapa 3). La base no se
    # toca, pero los cambios de Frontend o del generador ya no dependen de que llegue un Excel nuevo.
    if ($SinAbrir -and -not $firma) {
        if ($codeViejo -or $sinPanel) {
            Encabezado 'Sin Excel en Entrada  -  regenerando solo el panel' 'DarkYellow'
            $r3 = Paso 3 'Generando el dashboard' 'Backend\generador\construir_dashboard.py' 70 100 0
            if (-not $r3.Ok) { Fallo $r3.Texto; exit 10 }
            Medir $r3 'generar panel'
            Info 'La base no se movio: el panel sale con los datos que ya estaban, pero con el codigo nuevo.'
        } else {
            Encabezado 'Sin Excel en Entrada  -  nada que cargar' 'DarkYellow'
            Info 'Revise la letra de la unidad o que este conectada la donde vive Drive (DIAGNOSTICO.bat lo dice).'
        }
        exit 20
    }
    if ($Revisar -and $firma -and (Test-Path $htmlPath) -and (Test-Path $archivoFirma) -and -not $codeViejo -and
        ((Get-Content $archivoFirma -Raw).Trim() -eq $firma.Trim())) {
        Encabezado 'Todo al día  -  no hay Excel nuevos' 'DarkGreen'
        if (-not $Auto -and -not $SinAbrir) { Write-Host ''; Write-Host '  Abriendo el dashboard...' -ForegroundColor Black; AbrirDashboard $htmlPath; Start-Sleep -Seconds 2 }
        exit 0
    }
    if ($codeViejo) { Aviso 'El codigo del panel es mas nuevo que el dashboard: se vuelve a generar.' }

    # Etapa 1: 0 -> 20 %
    $r1 = Paso 1 'Respaldando la base de datos' 'Backend\etl\respaldo.py' 0 20 0
    if (-not $r1.Ok) { Fallo $r1.Texto; exit 10 }
    Medir $r1 'respaldo'

    # Etapa 2: 20 -> 70 %
    $r2 = Paso 2 'Leyendo los Excel de Entrada' 'Backend\etl\limpieza.py' 20 70 $totalArch
    if (-not $r2.Ok) { Fallo $r2.Texto; exit 10 }
    Medir $r2 'lectura de Excel'
    $t2 = $r2.Texto
    $nEx = [regex]::Matches($t2, '(?m)^.+?\.xlsx:').Count
    $conDatos = [regex]::Matches($t2, 'nuevas [1-9]').Count
    $nuevas = 0
    foreach ($m in [regex]::Matches($t2, 'nuevas (\d+)')) { $nuevas += [int]$m.Groups[1].Value }
    Info ("Excel revisados: $nEx   con datos nuevos: $conDatos   eventos nuevos: {0:N0}" -f $nuevas)
    $tot = [regex]::Match($t2, 'Total de eventos en la base:\s*(\d+)')
    if ($tot.Success) { Info ('Total de eventos en la base: {0:N0}' -f [int]$tot.Groups[1].Value) }
    if ($t2 -match 'SIN REGLA') {
        Aviso 'Hay eventos sin regla (no aparecen en los módulos):'
        foreach ($m in [regex]::Matches($t2, '(?m)^\s+-\s+(.+)$')) { Aviso ('   ' + $m.Groups[1].Value.Trim()) }
    }

    # Etapa 3: 70 -> 100 %
    $r3 = Paso 3 'Generando el dashboard' 'Backend\generador\construir_dashboard.py' 70 100 0
    if (-not $r3.Ok) { Fallo $r3.Texto; exit 10 }
    Medir $r3 'generar panel'
    $t3 = $r3.Texto
    $inc = [regex]::Match($t3, 'Eventos incluidos:\s*(\d+)\s*\|\s*periodo:\s*(.+)')
    if ($inc.Success) { Info ('Eventos incluidos: {0:N0}   |   Periodo: {1}' -f [int]$inc.Groups[1].Value, $inc.Groups[2].Value.Trim()) }

    $seg = [int]$reloj.Elapsed.TotalSeconds
    Encabezado ('LISTO  -  El dashboard quedó actualizado   (' + [math]::Floor($seg / 60) + ' min ' + ($seg % 60) + ' s)') 'DarkGreen'
    Info ($medidas -join '   ')
    # tiempos.log: una linea por ejecucion. Es la unica forma de saber despues si un cambio de codigo
    # realmente bajó el tiempo, y en que etapa (respaldo, Excel o panel) se esta yendo el reloj.
    try {
        $linea = '{0}  anos={1}  excel={2}  {3}  total={4}s' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $qAnios, $totalArch, ($medidas -join '  '), $seg
        Add-Content -Path (Join-Path $dirReg 'tiempos.log') -Value $linea -Encoding UTF8
    } catch { }

    Set-Content -Path $archivoFirma -Value $firma -Encoding UTF8
    $ruta = $htmlPath
    $mr = [regex]::Match($t3, 'Dashboard generado:\s*(.+?)\s*\(\d+ KB\)')
    if ($mr.Success -and (Test-Path $mr.Groups[1].Value)) { $ruta = $mr.Groups[1].Value }

    if ($Revisar -and -not $Auto -and -not $SinAbrir) {
        Write-Host ''; Write-Host '  Abriendo el dashboard...' -ForegroundColor Black
        AbrirDashboard $ruta; Start-Sleep -Seconds 2
    }
    elseif (-not $Auto -and -not $SinAbrir) {
        Write-Host ''
        Write-Host '  ¿Abrir el dashboard ahora?   [S] Sí    [N] No  ' -NoNewline -ForegroundColor Black
        do { $k = [Console]::ReadKey($true) } while ($k.KeyChar -notmatch '[sSnN]' -and $k.Key -ne 'Enter')
        if ($k.KeyChar -match '[sS]' -or $k.Key -eq 'Enter') { AbrirDashboard $ruta }
    }
}
catch {
    Fallo ($_ | Out-String)
    $codigo = 10
}
finally {
    if (-not $Auto) { $ui.BackgroundColor = $bgOrig; $ui.ForegroundColor = $fgOrig }
    Remove-Item (Join-Path $env:TEMP 'pemex_paso*') -ErrorAction SilentlyContinue
}
exit $codigo
