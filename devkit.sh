#!/usr/bin/env bash

# Check if the raw/ folder exists
if [ ! -d "data/raw" ]; then
    echo "You must run the proxy first!"
    exit 1
fi

if [ ! -d "devkit" ]; then
    mkdir devkit
    # Copy the raw data to a new devkit/ folder
    cp -r data/raw/* devkit
    # Copy over all the contents of the overwrite/ folder and overwrite any existing files
    cp -r injector/out/* devkit
    cp -r data/overwrite/* devkit

    # Format the JS bundle
    npx @biomejs/biome format --fix devkit/ || true
else
    echo "Devkit folder already exists. Overwriting..."
    cp -r data/overwrite/* devkit
fi