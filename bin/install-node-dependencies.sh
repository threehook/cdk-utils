#!/usr/bin/env bash

set -e

echo "!!! 'npm install' is used, update script to 'npm ci' as soon as node version has been updated in CodeBuild"
echo 

run_npm_ci () {
  (
  if [[ -d $1 ]]; then
    cd "$1"
    if [[ -f package.json ]]; then
      echo ">>> $1"
      npm install
    fi
  fi
  
  )
}

run_npm_ci ${PWD}

for dir in functions/*/nodejs/*/
do
    run_npm_ci ${dir}
done;

for dir in functions/*/src
do
    run_npm_ci ${dir}
done;

for dir in functions/*/
do
    run_npm_ci ${dir}
done;
