#!/bin/bash
go build -o main ../
chmod 744 main
AWS_REGION="eu-west-1" \
./main -i ./template.json -o ./output.json -r ../../../distr-complaint-service -b dpd-build-artifacts-test -v
