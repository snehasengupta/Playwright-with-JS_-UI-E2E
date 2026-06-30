@echo off
REM ============================================
REM  Smart Auto-Healer (v3)
REM  AI-powered agentic self-healing pipeline
REM  Independent attempts per failure, capped at 3
REM ============================================
REM
REM  Usage:
REM    smart-healer.bat <API_KEY>
REM    smart-healer.bat <API_KEY> --dry-run
REM    smart-healer.bat <API_KEY> --max-heal 5
REM    smart-healer.bat <API_KEY> --dry-run --max-heal 2
REM

SET API_KEY=%1

IF "%API_KEY%"=="" (
    echo.
    echo ERROR: Anthropic API key is required.
    echo.
    echo Usage: smart-healer.bat ^<API_KEY^> [--dry-run] [--max-heal N]
    echo.
    echo Examples:
    echo   smart-healer.bat sk-ant-xxxxx
    echo   smart-healer.bat sk-ant-xxxxx --dry-run
    echo   smart-healer.bat sk-ant-xxxxx --max-heal 5
    echo.
    exit /b 1
)

echo ============================================
echo  Smart Auto-Healer v3
echo  Phases: Classify - Locate - Heal - Verify
echo  Policy: independent attempts, no early stop
echo ============================================
echo.

node scripts/smart-healer.js %*

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ATTENTION] One or more failures escalated.
    echo See: healing-escalation.json
    echo See: healing-report.json
    exit /b 1
)

echo.
echo [DONE] All healable failures resolved, no escalations.
