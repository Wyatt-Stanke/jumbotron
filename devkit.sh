#!/usr/bin/env bash

# Check if the raw/ folder exists
if [ ! -d "raw" ]; then
    echo "You must run the proxy first!"
    exit 1
fi

if [ ! -d "devkit" ]; then
    # Copy the raw data to a new devkit/ folder
    cp -r raw devkit

    # Copy over all the contents of the overwrite/ folder and overwrite any existing files
    cp -r overwrite/* devkit

    # Format the JS bundle
    npx @biomejs/biome format --fix devkit/
else
    echo "Devkit folder already exists. Overwriting..."
    cp -r overwrite/* devkit
fi