#!/usr/bin/env bash

cd "$(dirname "$(realpath "$0")")" || exit 1

COLLEGE_MODE=false

# Check if the raw/ folder exists
if [ ! -d "data/raw" ]; then
    echo "You must run the proxy first!"
    exit 1
fi

if [ ! -d "devkit" ]; then
    npm run build --workspaces --if-present

    mkdir devkit
    # Copy the raw data to a new devkit/ folder
    if [ "$COLLEGE_MODE" = true ]; then
        cp -r data/raw_co/* devkit
    else
        cp -r data/raw/* devkit
    fi
    # Copy over all the contents of the overwrite/ folder and overwrite any existing files
    cp -r injector/out/* devkit
    cp -r data/overwrite/* devkit

    # Link this bash script to the devkit folder
    ln -s "$(pwd)/devkit.sh" devkit/devkit.sh

    # Format the JS bundle
    npx @biomejs/biome format --fix devkit/html5game/ || true
else
    echo "Devkit folder already exists. Rebuilding..."
    npm run build --workspaces --if-present
    cp -r injector/out/* devkit
    cp -r data/overwrite/* devkit
fi