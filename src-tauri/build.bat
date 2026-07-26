@echo off
call "D:\DCK\soft\VisualStudio18\VC\Auxiliary\Build\vcvars64.bat"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
cd /d "%~dp0"
cargo build %*
