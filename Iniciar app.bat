@echo off
rem Doble clic para levantar la app en tu compu (Docker + base de datos + web).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-app.ps1"
pause
