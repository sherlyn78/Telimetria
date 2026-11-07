@echo off
rem No es un boton nuevo: es el nombre viejo de ABRIR_DASHBOARD.bat, que ya hace todo solo
rem (revisa los Excel, actualiza si hace falta y abre el panel con servidor local).
rem Se guardo en Utilerias por si alguien tenia un acceso directo a este nombre; si alguno lo
rem apunta, cambie su destino a la raiz: General\ABRIR_DASHBOARD.bat (es exactamente lo mismo).
cd /d "%~dp0.."
call "%~dp0..\ABRIR_DASHBOARD.bat"
