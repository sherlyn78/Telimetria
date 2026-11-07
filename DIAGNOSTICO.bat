@echo off
chcp 65001 >nul
title PEMEX ALERTAS - Diagnostico (solo lectura)
cd /d "%~dp0"

rem ---------- Deteccion de Python: sube hasta 4 niveles buscando WinPython ----------
set "PY="
if defined PYTHON_PORTABLE if exist "%PYTHON_PORTABLE%" set "PY=%PYTHON_PORTABLE%"
if not defined PY for /d %%D in ("%~dp0..";"%~dp0..\..";"%~dp0..\..\..";"%~dp0..\..\..\..") do (
  if not defined PY if exist "%%~fD\WPy64-3.13.12.0\python\python.exe" set "PY=%%~fD\WPy64-3.13.12.0\python\python.exe"
  if not defined PY if exist "%%~fD\Python_portable\WPy64-3.13.12.0\python\python.exe" set "PY=%%~fD\Python_portable\WPy64-3.13.12.0\python\python.exe"
)
if not defined PY set "PY=python"

echo.
echo    Diagnostico del panel TAD. Solo lee: no toca la base, no mueve archivos, no abre Outlook.
echo.

rem El informe vive en Registros\; si la USB esta de solo lectura se guarda aqui, como siempre.
set "INFORME=%~dp0diagnostico.txt"
if not exist "%~dp0Registros" mkdir "%~dp0Registros" 2>nul
if exist "%~dp0Registros" set "INFORME=%~dp0Registros\diagnostico.txt"

"%PY%" -X utf8 "%~dp0Backend\diagnostico.py" > "%INFORME%" 2>&1
type "%INFORME%"

echo.
echo    El informe quedo guardado en: %INFORME%
echo    (ese archivo es el que hay que mandar para revisar lo que salio mal)
echo.
pause
