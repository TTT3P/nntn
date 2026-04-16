#!/bin/bash
# NNTN Sales Ops — Daily run wrapper
exec ~/Documents/Claude-Work/.venvs/notebooklm/bin/python \
  ~/Documents/Claude-Work/scripts/sales-ops/sales_ops_import.py \
  --run "$@"
