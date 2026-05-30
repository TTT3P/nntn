#!/bin/bash
# NNTN Sales Ops — Status check wrapper
exec ~/.venvs/notebooklm/bin/python \
  "$(dirname "$0")/sales_ops_import.py" \
  --check
