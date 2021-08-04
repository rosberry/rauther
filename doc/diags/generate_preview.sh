#!/bin/bash
# export UMPLET_PATH=/Users/test/Downloads/Umlet

if [ -d doc/diags/src ]; then
    for file in `find doc/diags/src -type f -name "*.uxf"`
    do
    $UMPLET_PATH/umlet.sh -action=convert -format=png -filename=$file -output=doc/diags/preview
    done
fi