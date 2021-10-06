import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
export interface UnmonitoredFunctionProps extends lambda.FunctionOptions {
    readonly runtime?: lambda.Runtime;
    readonly handler?: string;
    readonly path: string;
}
export declare class UnmonitoredFunction extends cdk.Construct {
    static logGroupName(fn: lambda.IFunction): string;
    readonly function: lambda.Function;
    readonly code: lambda.CfnParametersCode;
    readonly path: string;
    constructor(scope: cdk.Construct, id: string, props: UnmonitoredFunctionProps);
}
