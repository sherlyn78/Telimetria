@echo off
rem ============================================================================
rem  BOTON UNICO - es el unico que se usa todos los dias. Primero sale la tarjeta PASO DE
rem  CARGA para elegir que anos se leen de Entrada (ENTER = los que diga Backend\.env, hoy
rem  "todos"), revisa si hay Excel nuevos, actualiza solo si hace falta y abre el panel con
rem  servidor local (lo marcado se guarda en la base).
rem  Esta ventana tiene que quedarse abierta mientras use el dashboard.
rem  Los demas botones (forzar la carga, elegir ano, diagnostico, programar la tarea) viven
rem  en Utilerias\; ACTUALIZAR_AUTO.bat se queda aqui solo por la tarea del Programador.
rem ============================================================================
chcp 65001 >nul
title PEMEX ALERTAS - Panel TAD (no cierre esta ventana)
color F0
mode con: cols=78 lines=32 >nul 2>&1
cd /d "%~dp0"

rem ---------- Colores ANSI: letra oscura sobre FONDO BLANCO ----------
rem Windows Terminal hace caso omiso de "color F0", por eso salian las franjas negras.
rem El blanco se asegura de tres formas: OSC 11 deja la ventana en blanco, ESC[2J con el fondo
rem blanco puesto borra TODA la pantalla (cls borraria en negro), y cada color lleva su propio
rem fondo blanco (48;2;255;255;255) para que ninguna letra quede sobre negro.
for /f %%a in ('echo prompt $E^| cmd') do set "ESC=%%a"
set "FB=48;2;255;255;255"
set "PANTALLA=%ESC%]10;rgb:0000/0000/0000%ESC%\%ESC%]11;rgb:ffff/ffff/ffff%ESC%\"
set "B=%ESC%[1;%FB%m"
set "X=%ESC%[0;%FB%m"
set "C=%ESC%[%FB%;34m"
set "G=%ESC%[%FB%;32m"
set "R=%ESC%[%FB%;31m"
set "Y=%ESC%[%FB%;35m"
set "V=%ESC%[%FB%;36m"
set "D=%ESC%[%FB%;90m"
set "W=%ESC%[%FB%;30m"
set "A=%ESC%[%FB%;33m"
set "VERDE=%ESC%[1;48;2;22;122;61;97m"
set "LL=%W%"
rem PINTAR borra la pantalla USANDO el fondo blanco recien puesto (ESC[2J borra con el color
rem de fondo activo). cls no sirve: borraria con el negro de la ventana y quedarian manchas.
set "PINTAR=%ESC%[%FB%m%ESC%[2J%ESC%[H"
<nul set /p "=%PANTALLA%"

rem ---------- Deteccion de Python: sube hasta 4 niveles buscando WinPython ----------
set "PY="
if defined PYTHON_PORTABLE if exist "%PYTHON_PORTABLE%" set "PY=%PYTHON_PORTABLE%"
if not defined PY for /d %%D in ("%~dp0..";"%~dp0..\..";"%~dp0..\..\..";"%~dp0..\..\..\..") do (
  if not defined PY if exist "%%~fD\WPy64-3.13.12.0\python\python.exe" set "PY=%%~fD\WPy64-3.13.12.0\python\python.exe"
  if not defined PY if exist "%%~fD\Python_portable\WPy64-3.13.12.0\python\python.exe" set "PY=%%~fD\Python_portable\WPy64-3.13.12.0\python\python.exe"
)
if not defined PY set "PY=python"

rem ---------- Verifica si hay Excel nuevos y, si hacen falta, actualiza antes de abrir ----------
rem Usa la misma lista de Excel que leen la carga y el correo (Entrada, sus carpetas de ano y Historial).
rem Si la firma no cambió desde la ultima vez solo dice "Todo al dia" y no vuelve a cargar nada.
rem -SinAbrir: la barra de progreso se ve en ESTA ventana y no abre un segundo panel.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Backend\ACTUALIZAR_UI.ps1" -Py "%PY%" -Revisar -SinAbrir
set "RC=%ERRORLEVEL%"
rem RC es lo unico que se decide aqui: manda la linea "●" de la pantalla de abajo.
rem 0 = al dia, 20 = no se ve Entrada, 10 = fallo la carga, cualquier otro = ni siquiera
rem arranco la barra de progreso. No hay caso en que no se abra el panel con lo que haya.

:pantalla
<nul set /p "=%PANTALLA%%PINTAR%"
echo.
<nul set /p "=%ESC%[2;1H"
rem El logo se escribe desde la fila 2; al terminar el cursor queda justo debajo,
rem asi que las dos pasadas de parpadeo lo repintan en su sitio sin mover nada mas.
call :logo
for /l %%i in (1,1,2) do (
    <nul set /p "=%ESC%[2;1H"
    set "LL=%V%"
    call :logo
    powershell -NoProfile -Command "Start-Sleep -Milliseconds 300" >nul 2>&1
    <nul set /p "=%ESC%[2;1H"
    set "LL=%W%"
    call :logo
    powershell -NoProfile -Command "Start-Sleep -Milliseconds 300" >nul 2>&1
)
<nul set /p "=%ESC%[2;1H"
set "LL=%W%"
call :logo
echo.
rem ---------- Fecha en formato espanol ----------
rem %date% sale con el dia en ingles ("Mon 11/02/2026") y en el orden que usa cada equipo.
rem PowerShell la arma fija; si no estuviera, se queda con %date% y no pasa nada.
set "FECHA=%date% %time:~0,8%"
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "Get-Date -Format 'dd/MM/yyyy   HH:mm:ss'"`) do set "FECHA=%%d"

rem ---------- Que dice la linea ● segun RC ----------
rem ETQ mide siempre lo mismo (17 en los datos, 15 con el punto) para que los dos puntos
rem de todas las filas caigan en la misma columna. VAL cabe en la ventana: si fuera mas
rem largo, la consola lo pasa a la linea de abajo y la tarjeta se descuadra.
set "KOL=%G%"
set "ETQ=Datos al día   "
set "VAL=los Excel de Entrada ya estan cargados"
if "%RC%"=="0" goto estado_listo
set "KOL=%Y%"
set "ETQ=Sin Excel      "
set "VAL=no se ve Entrada (vea DIAGNOSTICO.bat)"
if "%RC%"=="20" goto estado_listo
set "KOL=%R%"
set "ETQ=Sin actualizar "
set "VAL=abre con lo guardado, vea el log de actualizacion"
if not "%RC%"=="10" set "VAL=no arranco la barra, vea ACTUALIZAR_SIMPLE.bat"
:estado_listo

rem ---------- Las tarjetas ----------
rem La barra ▌ del costado hace de marco: en la consola no se cierra la caja por la derecha
rem sin saber cuanto mide cada valor (la ruta de Python cambia de PC en PC).
echo    %C%▌%X% %C%%B%■ ESTADO DEL SISTEMA%X%
echo    %C%▌%X% %D%──────────────────────────────────────────────────────────────────%X%
echo    %C%▌%X%   %W%Fecha / hora     %X%%D%:%X% %V%%FECHA%%X%
echo    %C%▌%X%   %W%Usuario / equipo%X%%D%:%X% %V%%USERNAME:~0,14% @ %COMPUTERNAME:~0,14%%X%
echo    %C%▌%X%   %W%Python           %X%%D%:%X% %V%%PY:~0,48%%X%
echo    %C%▌%X%   %W%Panel            %X%%D%:%X% %V%http://127.0.0.1:8765 (o el siguiente libre)%X%
echo    %C%▌%X% %D%──────────────────────────────────────────────────────────────────%X%
echo    %C%▌%X%   %KOL%●%X% %KOL%%B%%ETQ%%X%%D%:%X% %D%%VAL%%X%
echo    %C%▌%X%
echo.
echo    %A%▌%X% %A%%B%⚠  ESTA VENTANA ES EL SERVIDOR%X%
echo    %A%▌%X%    No la cierre mientras trabaje en el panel.
echo    %A%▌%X%    Al terminar ciérrela: lo ultimo marcado ya quedo guardado.
echo    %A%▌%X%
echo.
<nul set /p "=%VERDE%   ▶  Iniciando servidor local...   %X%"
echo.

rem Abre el dashboard con servidor local: los estatus y motivos que se marquen se guardan en la base de datos.
"%PY%" "%~dp0Backend\servidor.py"

if errorlevel 1 (
    echo.
    echo    %R%%B%╔══════════════════════════════════════════════════════════════════╗%X%
    echo    %R%%B%║   ✖  EL SERVIDOR SE DETUVO CON UN ERROR                          ║%X%
    echo    %R%%B%╚══════════════════════════════════════════════════════════════════╝%X%
    echo.
    echo     %Y%Revise el mensaje de arriba y avise a soporte si persiste.%X%
    echo.
    pause
)
exit /b 0

rem ---------- Logo de PEMEX: 9 lineas de 73 columnas, letras en %%LL% ----------
:logo
echo %C%%B%   ╔════════════════════════════════════════════════════════════════════╗%X%
echo %C%%B%   ║  %LL%%B%██████╗ ███████╗███╗   ███╗███████╗██╗  ██╗%X%                       %C%║%X%
echo %C%%B%   ║  %LL%%B%██╔══██╗██╔════╝████╗ ████║██╔════╝╚██╗██╔╝%X%                       %C%║%X%
echo %C%%B%   ║  %LL%%B%██████╔╝█████╗  ██╔████╔██║█████╗   ╚███╔╝%X%                        %C%║%X%
echo %C%%B%   ║  %LL%%B%██╔═══╝ ██╔══╝  ██║╚██╔╝██║██╔══╝   ██╔██╗%X%                        %C%║%X%
echo %C%%B%   ║  %LL%%B%██║     ███████╗██║ ╚═╝ ██║███████╗██╔╝ ██╗%X%                       %C%║%X%
echo %C%%B%   ║  %LL%%B%╚═╝     ╚══════╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝%X%                       %C%║%X%
echo %C%%B%   ║          %V%%B%S I S T E M A   D E   A L E R T A S   ·   T A D%X%           %C%║%X%
echo %C%%B%   ╚════════════════════════════════════════════════════════════════════╝%X%
exit /b 0
