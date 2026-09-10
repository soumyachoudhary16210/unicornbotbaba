@echo off
title UNICORN GOODS Local Server
echo Starting UNICORN GOODS local test server...
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
