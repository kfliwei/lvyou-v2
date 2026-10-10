@echo off
rem 33-E 浏览器腿变异网的脱离终端启动器：这张网要跑 19 遍 smoke-topbar（小时级），
rem 用普通 Bash 后台任务会被 10 分钟超时杀掉，而杀在半路＝process.on('exit') 的还原不执行，树留在变异态。
cd /d F:\MyAi\trace\lvyou-v2
set MUT_LOG=tools/out/b33e-mut-smoke39.txt
node tools\out\mut-smoke39.js
echo EXITCODE=%ERRORLEVEL%>> tools\out\b33e-mut-smoke39.txt
