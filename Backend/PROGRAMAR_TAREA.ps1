# PROGRAMAR_TAREA.ps1
# Programa (o quita) la tarea del Programador de Windows que actualiza el panel sola, sin presionar nada.
#
# Por que ya no basta con la linea "schtasks /sc daily /st 06:00" que traia PROGRAMAR_ACTUALIZAR.bat:
# ese registro corre solo si a esa hora el equipo esta despierto, el usuario sesion activo y la memoria
# puesta. Si la USB no estaba conectada a las 06:00, esa ejecucion se pierde y no vuelve a intentarse.
# Aqui la misma tarea lleva reintentos cada 30 minutos hasta las 21:00 y un disparo al iniciar sesion,
# y el archivo sello de Registros\ultima_auto.txt hace que el dia ya resuelto no se repita.
#
# Modos:
#   (sin paramos)      registra la tarea. Pregunta la hora si no se le pasa con -Hora.
#   -Hora 06:00        hora del primer intento del dia.
#   -Hasta 21:00       hasta que hora sigue reintentando cada -Intervalo minutos.
#   -Intervalo 30      minutos entre reintentos.
#   -Estado            muestra como esta registrada la tarea ahora mismo.
#   -Probar            lanza la tarea en este momento y espera su resultado (no espera a las 6 am).
#   -Forzar            con -Probar: borra el sello del dia para que de verdad vuelva a cargar.
#   -Quitar            elimina la tarea.
#   -Disparar          es el modo que usa la propia tarea al sonar; no lo uses a mano salvo prueba.
#
# Ojo: la tarea guarda la ruta absoluta, con la letra de la memoria. Si en la otra laptop la USB monta
# otra letra, hay que volver a correr este programador alli.

param(
  [string]$Hora = '',
  [string]$Hasta = '21:00',
  [int]$Intervalo = 30,
  [switch]$Quitar,
  [switch]$Estado,
  [switch]$Probar,
  [switch]$Forzar,
  [switch]$Disparar
)

$ErrorActionPreference = 'Stop'

# El mismo nombre que usaba el .bat viejo, para no dejar dos tareas ni romper lo que ya este programado.
$TN    = 'Pemex Alertas - Actualizar dashboard'
$RAIZ  = Split-Path -Parent $PSScriptRoot
$AUTO  = Join-Path $RAIZ 'ACTUALIZAR_AUTO.bat'
$ESTE  = Join-Path $PSScriptRoot 'PROGRAMAR_TAREA.ps1'
$LOG   = Join-Path $RAIZ 'Registros\actualizacion.log'
$SE_USB  = Join-Path $RAIZ 'Registros\ultima_auto.txt'
$SE_TEMP = Join-Path $env:TEMP 'pemex_ultima_auto.txt'

function Apunta([string]$msg) {
  # El registro lo escribe normalmente el .bat; aqui solo se anotan las lineas del programador.
  # Se guarda en ASCII porque el archivo lo crea cmd con UTF-8 y un BOM a mitad del archivo se veria raro.
  try {
    $dir = Split-Path -Parent $LOG
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Add-Content -LiteralPath $LOG -Value $msg -Encoding ASCII
  } catch { }
}

function EscribeSello([string]$contenido) {
  # Primero la memoria, para que el sello viaje con el proyecto; si esta de solo lectura, el equipo local.
  foreach ($f in @($SE_USB, $SE_TEMP)) {
    try {
      $dir = Split-Path -Parent $f
      if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      Set-Content -LiteralPath $f -Value $contenido -Encoding ASCII
      return $f
    } catch { }
  }
  return ''
}

function LeeSello {
  # Devuelve @{fecha;estado;archivo} del sello mas reciente, o $null si no lo hay.
  $candidatos = @()
  foreach ($f in @($SE_USB, $SE_TEMP)) {
    try { if (Test-Path -LiteralPath $f) { $candidatos += (Get-Item -LiteralPath $f) } } catch { }
  }
  if ($candidatos.Count -eq 0) { return $null }
  $el = $candidatos | Sort-Object -Property LastWriteTime -Descending | Select-Object -First 1
  try {
    $linea = Get-Content -LiteralPath $el.FullName -TotalCount 1
    if ($linea -match '^([0-9]{4}-[0-9]{2}-[0-9]{2})\|([A-Za-z_]+)') {
      return @{ fecha = $matches[1]; estado = $matches[2]; archivo = $el.FullName }
    }
  } catch { }
  return $null
}

function HoraValida([string]$texto, [string]$nombre) {
  if ($texto -match '^([01]?[0-9]|2[0-3]):[0-5][0-9]$') {
    $p = $texto.Split(':')
    return ('{0:D2}:{1:D2}' -f [int]$p[0], [int]$p[1])
  }
  Write-Host "  '$texto' no es una hora valida para $nombre (formato 24 h, por ejemplo 06:00)." -ForegroundColor Yellow
  return ''
}

# ---------------------------------------------------------------- el disparo de la tarea
if ($Disparar) {
  if (-not (Test-Path -LiteralPath $AUTO)) {
    Apunta ("[programador] no encontro la ruta: " + $AUTO)
    Write-Host "No esta la carpeta del proyecto en $RAIZ" -ForegroundColor Red
    exit 1
  }
  $hoy = (Get-Date).ToString('yyyy-MM-dd')
  $sello = LeeSello
  if ($sello -and $sello.fecha -eq $hoy -and $sello.estado -ne 'fallo') {
    # Hoy ya termino bien, o hay un intento en curso: se sale sin escribir nada para no llenar el registro.
    exit 0
  }
  if ((EscribeSello ($hoy + '|en_curso')) -eq '') {
    Apunta ("[programador] no se pudo escribir el sello de dia; se omite la proteccion de duplicados")
  }
  Apunta ("[programador] " + (Get-Date).ToString('dd/MM/yyyy HH:mm') + " inicia actualizacion automatica")
  $rc = 98
  try {
    $hijo = Start-Process -FilePath $env:ComSpec -ArgumentList @('/c', "`"$AUTO`"") -WorkingDirectory $RAIZ `
                          -WindowStyle Hidden -Wait -PassThru
    if ($hijo -and $null -ne $hijo.ExitCode) { $rc = $hijo.ExitCode }
  } catch {
    $rc = 99
  }
  if ($rc -eq 0) {
    EscribeSello ($hoy + '|ok') | Out-Null
    Apunta ("[programador] termino bien (" + (Get-Date).ToString('HH:mm') + ")")
  } else {
    EscribeSello ($hoy + '|fallo') | Out-Null
    Apunta ("[programador] termino con codigo " + $rc + "; reintentara en " + $Intervalo + " minutos")
  }
  exit $rc
}

# ---------------------------------------------------------------- quitar
if ($Quitar) {
  try {
    Unregister-ScheduledTask -TaskName $TN -Confirm:$false
    Write-Host "  La tarea '$TN' fue quitada del Programador." -ForegroundColor Green
  } catch {
    Write-Host "  No habia ninguna tarea programada con ese nombre." -ForegroundColor Yellow
  }
  exit 0
}

# ---------------------------------------------------------------- estado
if ($Estado) {
  try {
    $t = Get-ScheduledTask -TaskName $TN
    $i = Get-ScheduledTaskInfo -TaskName $TN
    Write-Host "  Tarea   : $($t.TaskName)"
    Write-Host "  Estado  : $($t.State)"
    Write-Host "  Ejecuta : $($t.Actions[0].Execute) $($t.Actions[0].Arguments)"
    Write-Host "  Disparos: $(($t.Triggers | ForEach-Object { $_.CimClass.CimClassName }) -join ' + ')"
    foreach ($tr in $t.Triggers) {
      $rep = $tr.Repetition
      if ($rep -and $rep.Interval) {
        Write-Host "          $($tr.StartBoundary) cada $($rep.Interval) hasta $($rep.Duration)"
      } else {
        Write-Host "          $($tr.StartBoundary) (sin reintentos)"
      }
    }
    Write-Host "  Proxima : $($i.NextRunTime)"
    Write-Host "  Ultima  : $($i.LastRunTime)  resultado $($i.LastTaskResult)"
    $s = LeeSello
    if ($s) { Write-Host "  Sello   : $($s.fecha) $($s.estado)  ($($s.archivo))" }
    else { Write-Host "  Sello   : ninguno todavía" }
  } catch {
    Write-Host "  Esta tarea no esta programada en este equipo." -ForegroundColor Yellow
  }
  exit 0
}

# ---------------------------------------------------------------- probar ahora
if ($Probar) {
  try { Get-ScheduledTask -TaskName $TN | Out-Null } catch {
    Write-Host "  Primero hay que registrar la tarea (ejecuta este archivo sin parametros)." -ForegroundColor Yellow
    exit 1
  }
  if ($Forzar) {
    foreach ($f in @($SE_USB, $SE_TEMP)) { try { Remove-Item -LiteralPath $f -Force -ErrorAction Stop } catch { } }
    Write-Host "  Sello del dia borrado: la prueba va a cargar de nuevo." -ForegroundColor Cyan
  }
  Write-Host "  Iniciando la tarea ahora; puede tardar varios minutos..." -ForegroundColor Cyan
  Start-ScheduledTask -TaskName $TN
  $espera = 0
  while ($espera -lt 1800) {
    Start-Sleep -Seconds 15
    $espera += 15
    $t = Get-ScheduledTask -TaskName $TN
    if ($t.State -ne 'Running') { break }
    Write-Host "." -NoNewline
  }
  $t = Get-ScheduledTask -TaskName $TN
  $i = Get-ScheduledTaskInfo -TaskName $TN
  Write-Host ""
  if ($t.State -eq 'Running') {
    Write-Host "  Sigue corriendo después de 30 minutos; dejala terminar y mira Registros\actualizacion.log." -ForegroundColor Yellow
  } elseif ($i.LastTaskResult -eq 0) {
    Write-Host "  La tarea corrio completa y sin errores a las $($i.LastRunTime.ToString('HH:mm'))." -ForegroundColor Green
  } else {
    Write-Host "  Termino con codigo $($i.LastTaskResult). Mira Registros\actualizacion.log." -ForegroundColor Yellow
  }
  $s = LeeSello
  if ($s) { Write-Host "  Sello: $($s.fecha) $($s.estado) ($($s.archivo))" }
  exit 0
}

# ---------------------------------------------------------------- registrar
if ($Hora -eq '') {
  Write-Host "  La hora por defecto es 06:00 y desde esa hora se reintentara cada $Intervalo minutos hasta las $Hasta."
  $entra = Read-Host "  Hora del primer intento (ENTER = 06:00)"
  if ($entra -eq '') { $Hora = '06:00' } else { $Hora = HoraValida $entra 'la hora de inicio' }
  while ($Hora -eq '') {
    $entra = Read-Host "  Escribe de nuevo la hora de inicio"
    if ($entra -eq '') { $Hora = '06:00' } else { $Hora = HoraValida $entra 'la hora de inicio' }
  }
} else {
  $Hora = HoraValida $Hora 'la hora de inicio'
  if ($Hora -eq '') { exit 2 }
}
$Hasta = HoraValida $Hasta 'la hora de limite'
if ($Hasta -eq '') { exit 2 }

$ini = (Get-Date).Date + [TimeSpan]::Parse($Hora)
$fin = (Get-Date).Date + [TimeSpan]::Parse($Hasta)
$minutos = [int][Math]::Max(0, ($fin - $ini).TotalMinutes)
$repite = $minutos -gt $Intervalo

$disparo = New-ScheduledTaskTrigger -Daily -At $ini
if ($repite) {
  # Truco documentado por Microsoft: el disparo de repeticion se arma con un trigger -Once y se lo
  # monta al diario. Sin esto el Programador solo admite "cada X" sin hora de limite.
  $tmp = New-ScheduledTaskTrigger -Once -At $ini `
          -RepetitionInterval (New-TimeSpan -Minutes $Intervalo) `
          -RepetitionDuration (New-TimeSpan -Minutes $minutos)
  $disparo.Repetition = $tmp.Repetition
}
# Al iniciar sesion se da otra oportunidad: si la memoria se conecto despues de encender el equipo,
# ese disparo agarra la actualizacion el mismo dia aunque la 06:00 haya pasado.
$alEntrar = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$ajuste = New-ScheduledTaskSettingsSet -StartWhenAvailable `
          -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
          -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3)

$accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
           -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"$ESTE`" -Disparar") `
           -WorkingDirectory $RAIZ

$descripcion = "Actualiza el panel de conduccion TAD desde " + $RAIZ +
  ". Reintenta cada $Intervalo minutos entre las $Hora y las $Hasta hasta que la memoria este conectada."

$registada = $false
try {
  Register-ScheduledTask -TaskName $TN -Action $accion -Trigger @($disparo, $alEntrar) `
    -Settings $ajuste -Description $descripcion -Force | Out-Null
  $registada = $true
} catch {
  Write-Host "  El Programador rechazo el registro con PowerShell: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "  Se intenta la forma antigua (diaria, sin reintentos)." -ForegroundColor Yellow
  try {
    $tr = '"' + $ESTE + '" -Disparar'
    & schtasks.exe /create /tn $TN /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tr" `
        /sc daily /st $Hora /f | Out-Null
    if ($LASTEXITCODE -eq 0) { $registada = $true }
  } catch { }
}

if (-not $registada) {
  Write-Host ""
  Write-Host "  No se pudo programar en este equipo. Abre el Programador de tareas y crea la tarea a mano" -ForegroundColor Red
  Write-Host "  con accion: powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$ESTE`" -Disparar"
  exit 1
}

Write-Host ""
Write-Host "  Listo. La tarea '$TN':" -ForegroundColor Green
if ($repite) {
  Write-Host "    - intenta desde las $Hora cada $Intervalo minutos hasta las $Hasta"
} else {
  Write-Host "    - diaria a las $Hora (sin reintentos, porque el rango $Hora-$Hasta es muy corto)" -ForegroundColor Yellow
}
Write-Host "    - y tambien al iniciar sesion en esta laptop"
Write-Host "    - si la memoria no esta puesta, no hace nada y vuelve a intentar mas tarde"
Write-Host "    - si ya actualizo hoy, no repite el trabajo (sello Registros\ultima_auto.txt)"
Write-Host "  Proxima ejecucion: $((Get-ScheduledTaskInfo -TaskName $TN).NextRunTime)"
Write-Host "  Ruta grabada en la tarea: $RAIZ  (si en otra laptop la USB es otra letra, programa ahi tambien)"
Write-Host "  Para ver como quedo:     powershell -File `"$ESTE`" -Estado"
Write-Host "  Para probarla ahora:     powershell -File `"$ESTE`" -Probar -Forzar"
Write-Host "  Para quitarla:           powershell -File `"$ESTE`" -Quitar"
exit 0

