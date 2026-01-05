#!/bin/bash

# read remote from remote.txt
if [ ! -f remote.txt ]; then
    echo "Error: remote.txt file not found!"
    exit 1
fi
REMOTE=$(cat remote.txt)
# call copy-remote.sh with the remote
./copy-remote.sh "$REMOTE"