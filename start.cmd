@echo off
rem Start the app locally: a static web server for the folder app\ and
rem the page in the browser. Needs Python 3 only, nothing is installed.
rem Stop the server with Ctrl+C or by closing this window.
setlocal

rem Anaconda at its usual place, otherwise the python of the PATH
set "PYTHON=C:\ProgramData\anaconda3\python.exe"
if not exist "%PYTHON%" set "PYTHON=python"

echo Interaction diagram: http://localhost:8000/
echo Stop the server with Ctrl+C.
start "" http://localhost:8000/
"%PYTHON%" -m http.server 8000 --directory "%~dp0app"
if errorlevel 1 (
    echo.
    echo The server did not start. Is Python 3 installed, is port 8000 free?
    pause
)