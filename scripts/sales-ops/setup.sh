#!/bin/bash
# NNTN Sales Ops — Setup wrapper (avoids long path paste errors)
exec ~/Documents/Claude-Work/.venvs/notebooklm/bin/python \
  ~/Documents/Claude-Work/scripts/sales-ops/sales_ops_import.py \
  --setup "$@"
