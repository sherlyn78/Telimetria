@echo off
chcp 65001 >nul
setlocal
rem Este boton ya no es el de todos los dias: ese es ABRIR_DASHBOARD.bat, que esta en la raiz y hace
rem lo mismo (revisa, actualiza y abre el panel). Aqui queda el que fuerza la carga sin abrir nada,
rem y el que pregunta el ano. Vive en Utilerias, asi que todo lo dems se cuenta un nivel arriba.
cd /d "%~dp0.."

rem Modo automatico (lo usa ACTUALIZAR_AUTO.bat): sin colores, sin preguntas
rem Modo revisar (ACTUALIZAR.bat revisar): actualiza solo si hay Excel nuevos y al terminar abre el panel
set "MODO="
if /i "%~1"=="auto" set "MODO=-Auto"
if /i "%~1"=="revisar" set "MODO=-Revisar"
if /i not "%~1"=="auto" ( color F0 & mode con cols=84 lines=30 )

rem Anos a cargar: el que se escriba detras del boton (ACTUALIZAR.bat 2026, o ACTUALIZAR.bat revisar 2027).
rem Sin argumento es la pantalla la que pregunta. Se pasa a ACTUALIZAR_UI.ps1 con -Anios.
set "ANIOS=%~2"
if "%ANIOS%"=="" set "ANIOS=%~1"
if /i "%ANIOS%"=="auto" set "ANIOS="
if /i "%ANIOS%"=="revisar" set "ANIOS="

set "PY="
if defined PYTHON_PORTABLE if exist "%PYTHON_PORTABLE%" set "PY=%PYTHON_PORTABLE%"
rem Sube hasta 5 niveles buscando WinPython (uno mas que antes porque este boton ya no vive en la raiz)
if not defined PY for /d %%D in ("%~dp0.";"%~dp0..";"%~dp0..\..";"%~dp0..\..\..";"%~dp0..\..\..\..") do (
  if not defined PY if exist "%%~fD\WPy64-3.13.12.0\python\python.exe" set "PY=%%~fD\WPy64-3.13.12.0\python\python.exe"
  if not defined PY if exist "%%~fD\Python_portable\WPy64-3.13.12.0\python\python.exe" set "PY=%%~fD\Python_portable\WPy64-3.13.12.0\python\python.exe"
)
if not defined PY set "PY=python"

rem Con etiquetas en lugar de if (...) else (...) para que una ruta de Python con parentesis
rem no rompa el bloque (aqui WinPython suele vivir en rutas con espacios y parentesis).
if not "%ANIOS%"=="" goto conanios
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\Backend\ACTUALIZAR_UI.ps1" -Py "%PY%" %MODO%
goto mediido
:conanios
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\Backend\ACTUALIZAR_UI.ps1" -Py "%PY%" %MODO% -Anios "%ANIOS%"
:mediido
set "RC=%errorlevel%"

rem 0 = todo bien, 10 = fallo ya mostrado por la pantalla; otro valor = no abrio PowerShell
if "%RC%"=="0" goto fin
if "%RC%"=="10" goto fin
echo.
echo  No se pudo abrir la pantalla de progreso en este equipo.
echo  Use ACTUALIZAR_SIMPLE.bat, en esta misma carpeta Utilerias, que hace lo mismo sin barra.
echo.
if not defined MODO pause
:fin
endlocal & exit /b %RC%
