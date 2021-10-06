import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';

export interface UnmonitoredFunctionProps extends lambda.FunctionOptions {
    readonly runtime?: lambda.Runtime;
    readonly handler?: string;
    readonly path: string;
}

export class UnmonitoredFunction extends cdk.Construct {
    static logGroupName(fn: lambda.IFunction): string {
        return `/aws/lambda/${fn.functionName}`;
    }
    readonly function: lambda.Function;
    readonly code = lambda.Code.fromCfnParameters();
    readonly path: string;

    constructor(scope: cdk.Construct, id: string, props: UnmonitoredFunctionProps) {
        super(scope, id);

        this.function = new lambda.Function(this, id, ensureDefaults(props, this.code));
        this.path = props.path;

        new logs.LogGroup(this, 'LogGroup', {
            logGroupName: UnmonitoredFunction.logGroupName(this.function),
            retention: logs.RetentionDays.TWO_MONTHS,
        });
        
        cdk.Tags.of(this).add('dpg:lambda:path', props.path);
    }
}

const ensureDefaults = (props: UnmonitoredFunctionProps, code: lambda.CfnParametersCode): lambda.FunctionProps => {
    return Object.assign({ code }, defaults, props);
};

const defaults = {
    runtime: lambda.Runtime.GO_1_X,
    handler: 'main',
    tracing: lambda.Tracing.ACTIVE,
};
