#!/bin/bash
# NNTN Sales Ops — Setup wrapper (avoids long path paste errors)
exec ~/.venvs/notebooklm/bin/python \
  "$(dirname "$0")/sales_ops_import.py" \
  --setup "$@"
