@echo off
chcp 65001 >nul
setlocal
rem Este archivo esta en Utilerias; el proyecto y el boton diario (ACTUALIZAR_AUTO.bat) estan un nivel arriba
cd /d "%~dp0.."
echo.
echo  === Programar la actualizacion automatica del dashboard ===
echo  Cada dia a la hora que elijas se cargaran los Excel de la carpeta Entrada y se regenerara el dashboard.
echo  El equipo debe estar encendido y esta carpeta debe estar disponible a esa hora.
echo.
set "HORA=09:00"
set /p HORA="  Hora de ejecucion en formato 24 h (ENTER = 09:00): "
if "%HORA%"=="" set "HORA=09:00"
schtasks /create /tn "Pemex Alertas - Actualizar dashboard" /tr "\"%~dp0..\ACTUALIZAR_AUTO.bat\"" /sc daily /st %HORA% /f
if errorlevel 1 (
  echo.
  echo  No se pudo crear la tarea. Prueba abrir este archivo con clic derecho - Ejecutar como administrador.
) else (
  echo.
  echo  Listo. Se ejecutara todos los dias a las %HORA%. El resultado queda en Registros\actualizacion.log
  echo  Para quitarla: schtasks /delete /tn "Pemex Alertas - Actualizar dashboard" /f
)
echo.
pause
endlocal
