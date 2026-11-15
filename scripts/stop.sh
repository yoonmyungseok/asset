#!/bin/bash
PID=$(lsof -ti :4000 || true)
if [ -n "$PID" ]; then
    kill -9 $PID
    echo "Stopped server on port 4000 (PID: $PID)"
else
    echo "No process running on port 4000"
fi
