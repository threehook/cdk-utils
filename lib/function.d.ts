import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import { ServiceApi } from './serviceapi';
import { UnmonitoredFunction } from './unmonitored_function';
export interface FunctionProps extends lambda.FunctionOptions {
    readonly errorsNotifierFunction: UnmonitoredFunction;
    readonly runtime?: lambda.Runtime;
    readonly handler?: string;
    readonly path: string;
}
export declare class Function extends cdk.Construct {
    static logGroupName(fn: lambda.IFunction): string;
    readonly function: lambda.Function;
    readonly code: lambda.CfnParametersCode;
    readonly path: string;
    constructor(scope: cdk.Construct, id: string, props: FunctionProps);
    on(api: ServiceApi, httpPath: string, httpMethod: string): void;
}
