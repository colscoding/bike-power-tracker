#!/bin/bash

# build client
./packages/client/build-apk.sh
if [ $? -ne 0 ]; then
    echo "Client build failed. Aborting copy to phone."
    exit 1
fi
# copy to phone
./copy-to-phone.sh
if [ $? -ne 0 ]; then
    echo "Copy to phone failed."
    exit 1
fi
echo "Build and copy to phone completed successfully."