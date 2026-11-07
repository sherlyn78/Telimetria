@echo off
chcp 65001 >nul
rem Lo usa el Programador de tareas: actualiza sin pausas y guarda el resultado en un registro.
rem No es un boton para el usuario; se queda en la raiz porque la tarea ya creada apunta a esta
rem ruta exacta (schtasks graba la ruta completa al crearse). Lo que ejecuta esta en Utilerias.
cd /d "%~dp0"
rem El registro vive en Registros\; si la USB esta de solo lectura se escribe aqui, como siempre.
set "LOG=actualizacion.log"
if not exist "Registros" mkdir "Registros" 2>nul
if exist "Registros" set "LOG=Registros\actualizacion.log"
echo ===== %date% %time% ===== >> "%LOG%"
call "%~dp0Utilerias\ACTUALIZAR.bat" auto >> "%LOG%" 2>&1
