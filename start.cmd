@echo off
rem Start the app locally: serve.py serves the folder app\ and opens the
rem page in the browser as soon as the server is ready.
rem Needs Python 3 only, nothing is installed.
rem Stop the server with Ctrl+C or by closing this window.
setlocal

rem Anaconda at its usual place, otherwise the python of the PATH
set "PYTHON=C:\ProgramData\anaconda3\python.exe"
if not exist "%PYTHON%" set "PYTHON=python"

"%PYTHON%" "%~dp0serve.py" %*
if errorlevel 1 (
    echo.
    echo The server did not start. Is Python 3 installed, is port 8000 free?
    pause
)
