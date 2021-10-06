#!/usr/bin/env bash

# This scripts enables using AWS Lambda Layers for Typescript functions.
# It links the found layers to /opt/nodejs, so the build step can use the layers. 

set -e

link_layers () {
  (
  if [[ -d $1 ]]; then
    cd "$1"
    if [[ -f package.json ]]; then
      echo "> linking layer $(basename $1)"
      mkdir -p /opt/nodejs
      ln -s "${PWD}" "/opt/nodejs/$(basename $1)"
    fi
  fi
  )
}

if [ -d functions ]; then
  for dir in functions/*/nodejs/*/
  do
    echo ${dir}
    link_layers ${dir}
  done;
else
  echo skip linking layers, because no layers found
fi
