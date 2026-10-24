@echo off
REM Abre o Speak Up no navegador do PC (sem instalar nada alem do Python).
REM Deixe esta janela preta aberta enquanto usa o app. Para fechar: Ctrl+C ou feche a janela.
cd /d "%~dp0"
echo.
echo  Speak Up rodando em http://localhost:8080
echo  NAO feche esta janela enquanto estiver usando o app.
echo.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8080"
py -m http.server 8080 --bind 127.0.0.1 2>nul || python -m http.server 8080 --bind 127.0.0.1
echo.
echo  Nao encontrei o Python. Instale em python.org e marque "Add python.exe to PATH".
pause
