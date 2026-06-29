@echo off
REM ============================================
REM  Playwright Auto-Healer Script
REM  Automatically fixes broken test selectors
REM ============================================

REM Set your Anthropic API key here or pass as argument
SET API_KEY=%1
SET TEST_FILE=%2

IF "%API_KEY%"=="" (
    echo ERROR: API key is required.
    echo.
    echo Usage: auto-healer.bat ^<API_KEY^> ^<TEST_FILE^>
    echo Example: auto-healer.bat sk-ant-xxxxx tests\myTest.spec.js
    exit /b 1
)

IF "%TEST_FILE%"=="" (
    echo ERROR: Test file path is required.
    echo.
    echo Usage: auto-healer.bat ^<API_KEY^> ^<TEST_FILE^>
    echo Example: auto-healer.bat sk-ant-xxxxx tests\myTest.spec.js
    exit /b 1
)

echo ============================================
echo  Playwright Auto-Healer
echo ============================================
echo.
echo Target File: %TEST_FILE%
echo.

REM Check if the test file exists
IF NOT EXIST "%TEST_FILE%" (
    echo ERROR: Test file not found: %TEST_FILE%
    exit /b 1
)

echo [1/3] Reading failed test file...
echo [2/3] Sending to AI for analysis and healing...

node auto-healer.js %API_KEY% %TEST_FILE%

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FAILED] Auto-healing failed. Check the error above.
    exit /b 1
)

echo [3/3] Healing complete!
echo.
echo ============================================
echo  Results:
echo  - Healed file: %TEST_FILE%
echo  - Backup: %TEST_FILE%.backup
echo  - Report: healing-report.json
echo ============================================
echo.
echo TIP: Run your test again to verify the fix:
echo   npx playwright test %TEST_FILE%
