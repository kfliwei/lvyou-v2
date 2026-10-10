@echo off
cd /d F:\MyAi\trace\lvyou-v2
node tools\visual-check.js > tools\out\b33e-baseline-readonly.txt 2>&1
echo EXITCODE=%ERRORLEVEL%>> tools\out\b33e-baseline-readonly.txt
