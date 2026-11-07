@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
rem Esta pantalla vive en Utilerias: los .bat de un clic van en la raiz del proyecto.
cd /d "%~dp0.."

rem ---- Modo automatico (lo usa ACTUALIZAR_AUTO.bat): sin colores, sin preguntas, sin pausas ----
set "AUTO=0"
if /i "%~1"=="auto" set "AUTO=1"
rem ---- Anos a cargar: ACTUALIZAR_SIMPLE.bat 2026  /  ACTUALIZAR_SIMPLE.bat auto 2026,2027 ----
if not "%~2"=="" set "ANIOS_CARGA=%~2"
if not defined ANIOS_CARGA if /i not "%~1"=="auto" if not "%~1"=="" set "ANIOS_CARGA=%~1"
rem Sin argumento se pregunta (en automatico nadie esta enfrente y se usa lo que diga Backend\.env)
if not defined ANIOS_CARGA if not "%AUTO%"=="1" set /p "ANIOS_CARGA=  Anios a cargar  [Enter = todos]  ej. 2026  o  2026,2027:  "

set "ESC="
if "%AUTO%"=="0" for /f %%a in ('echo prompt $E^| cmd') do set "ESC=%%a"
set "CT=" & set "CG=" & set "CR=" & set "CY=" & set "CD=" & set "R="
if defined ESC (
  set "CT=%ESC%[96m"
  set "CG=%ESC%[92m"
  set "CR=%ESC%[91m"
  set "CY=%ESC%[93m"
  set "CD=%ESC%[90m"
  set "R=%ESC%[0m"
)
if "%AUTO%"=="0" ( cls & title PEMEX ALERTAS - Actualizando dashboard )

rem ---- Python ----
set "PY="
if defined PYTHON_PORTABLE if exist "%PYTHON_PORTABLE%" set "PY=%PYTHON_PORTABLE%"
rem Sube hasta 5 niveles buscando WinPython, para que funcione aunque el proyecto este dentro de otra carpeta
if not defined PY for /d %%D in ("%~dp0.";"%~dp0..";"%~dp0..\..";"%~dp0..\..\..";"%~dp0..\..\..\..";"%~dp0..\..\..\..\..") do (
  if not defined PY if exist "%%~fD\WPy64-3.13.12.0\python\python.exe" set "PY=%%~fD\WPy64-3.13.12.0\python\python.exe"
  if not defined PY if exist "%%~fD\Python_portable\WPy64-3.13.12.0\python\python.exe" set "PY=%%~fD\Python_portable\WPy64-3.13.12.0\python\python.exe"
)
if not defined PY set "PY=python"

echo.
echo %CT%  ============================================================%R%
echo %CT%    PEMEX ALERTAS  ^|  Monitor de conduccion en TAD%R%
echo %CT%  ============================================================%R%
echo.
echo   Se cargan los Excel nuevos y se actualiza el dashboard.
echo   Tarda un par de minutos. %CY%No cierre esta ventana.%R%
echo.

"%PY%" --version >nul 2>&1
if errorlevel 1 goto sinpython

set "D1=%TEMP%\pemex_paso1.log"
set "D2=%TEMP%\pemex_paso2.log"
set "D3=%TEMP%\pemex_paso3.log"

call :paso 1 "Respaldando la base de datos" "Backend\etl\respaldo.py"
if errorlevel 1 goto error

call :paso 2 "Leyendo los Excel de la carpeta Entrada" "Backend\etl\limpieza.py"
if errorlevel 1 goto error
set "NX=0" & set "NN=0"
for /f %%n in ('findstr /c:".xlsx:" "%D2%" ^| find /c /v ""') do set "NX=%%n"
for /f %%n in ('findstr /r /c:"nuevas [1-9]" "%D2%" ^| find /c /v ""') do set "NN=%%n"
echo         %CD%Excel revisados: %NX%   con datos nuevos: %NN%%R%
for /f "delims=" %%l in ('findstr /b /c:"Total de eventos" "%D2%"') do echo         %CD%%%l%R%
findstr /c:"SIN REGLA" "%D2%" >nul 2>&1
if not errorlevel 1 (
  echo         %CY%Aviso: hay eventos sin regla ^(no aparecen en los modulos^):%R%
  for /f "delims=" %%l in ('findstr /b /c:"  - " "%D2%"') do echo         %CY%%%l%R%
)

call :paso 3 "Generando el dashboard" "Backend\generador\construir_dashboard.py"
if errorlevel 1 goto error
for /f "delims=" %%l in ('findstr /b /c:"Eventos incluidos" "%D3%"') do echo         %CD%%%l%R%

echo.
echo %CG%  ============================================================%R%
echo %CG%    LISTO  -  El dashboard quedo actualizado%R%
echo %CG%  ============================================================%R%

rem ---- Ruta real del dashboard (la que imprime el generador) ----
set "RUTA="
for /f "tokens=1,* delims=:" %%a in ('findstr /b /c:"Dashboard generado:" "%D3%"') do set "RUTA=%%b"
if defined RUTA (
  set "RUTA=!RUTA:~1!"
  for /f "delims=(" %%r in ("!RUTA!") do set "RUTA=%%r"
  set "RUTA=!RUTA:~0,-1!"
)
if not exist "!RUTA!" set "RUTA=%~dp0..\Salida\dashboard.html"

del "%D1%" "%D2%" "%D3%" >nul 2>&1
if "%AUTO%"=="1" goto fin
echo.
choice /c SN /n /m "  Abrir el dashboard ahora? [S/N] "
rem Se abre con el servidor local para que lo marcado (Descartada / motivo) se guarde en la base de datos.
if not errorlevel 2 (
  if exist "%~dp0..\Backend\servidor.py" (
    start "PEMEX ALERTAS - Dashboard editable (no cierre esta ventana)" "%PY%" "%~dp0..\Backend\servidor.py"
  ) else (
    start "" "!RUTA!"
  )
)
goto fin

:sinpython
echo %CR%  No se pudo ejecutar Python. Detenerse aqui y avisar a TI.%R%
goto pausa

:error
echo.
echo %CR%  ============================================================%R%
echo %CR%    ALGO FALLO  -  el dashboard NO se actualizo%R%
echo %CR%  ============================================================%R%
echo.
echo   Detalle tecnico ^(enviar una captura de esta pantalla a soporte^):
echo %CD%  ------------------------------------------------------------%R%
type "!ULT!"
echo %CD%  ------------------------------------------------------------%R%

:pausa
echo.
if "%AUTO%"=="0" pause
:fin
endlocal
exit /b 0

rem ---- Ejecuta un paso, oculta su salida tecnica y la guarda en un log temporal ----
:paso
set "ULT=%TEMP%\pemex_paso%~1.log"
echo   %CT%[%~1/3]%R% %~2 ...
"%PY%" "%~3" > "!ULT!" 2>&1
set "RC=!errorlevel!"
if "%AUTO%"=="1" type "!ULT!"
if not "!RC!"=="0" exit /b 1
echo         %CG%[OK]%R%
exit /b 0
