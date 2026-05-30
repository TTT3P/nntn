#!/bin/bash
# NNTN Sales Ops — Daily run wrapper
exec ~/.venvs/notebooklm/bin/python \
  "$(dirname "$0")/sales_ops_import.py" \
  --run "$@"
