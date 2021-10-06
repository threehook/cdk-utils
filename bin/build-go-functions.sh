#!/usr/bin/env bash

set -e

pushd () {
    command pushd "$@" > /dev/null
}

popd () {
    command popd > /dev/null
}

find . -name main.go -print0 | xargs -0 -n1 dirname | sort --unique | while read -r name; do
  pushd "$name";
  echo "building go for $name..."
  go build -ldflags="-s -w" -o main .
  status=$?
  [ $status -eq 0 ] || exit $status
  popd;
done

find . -name "*.go" -not -path "*/node_modules/*" -print0 | xargs -0 -n1 dirname | sort --unique | while read -r name; do
  pushd "$name";
  if ! (go test .); then
    exit 1
  fi
  popd;
done
