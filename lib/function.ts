import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import { LambdaDestination } from '@aws-cdk/aws-logs-destinations';
import { ServiceApi } from './serviceapi';
import { UnmonitoredFunction} from './unmonitored_function';

export interface FunctionProps extends lambda.FunctionOptions {
    readonly errorsNotifierFunction : UnmonitoredFunction;
    readonly runtime?: lambda.Runtime;
    readonly handler?: string;
    readonly path: string;
}

export class Function extends cdk.Construct {
    static logGroupName(fn: lambda.IFunction): string {
        return `/aws/lambda/${fn.functionName}`;
    }
    readonly function: lambda.Function;
    readonly code = lambda.Code.fromCfnParameters();
    readonly path: string;

    constructor(scope: cdk.Construct, id: string, props: FunctionProps) {
        super(scope, id);

        this.function = new lambda.Function(this, id, ensureDefaults(props, this.code));
        this.path = props.path;

        new logs.LogGroup(this, 'LogGroup', {
            logGroupName: Function.logGroupName(this.function),
            retention: logs.RetentionDays.TWO_MONTHS,
        }).addSubscriptionFilter('SubscriptionFilter', {
            destination: new LambdaDestination(props.errorsNotifierFunction.function),
            filterPattern: logs.FilterPattern.anyTerm('level=error', 'Task timed out', 'panic:'),
        });
        
        cdk.Tags.of(this).add('dpg:lambda:path', props.path);
    }

    on(api: ServiceApi, httpPath: string, httpMethod: string): void {
        api.withFunctionOn(httpPath, httpMethod, this.function);
    }
}

const ensureDefaults = (props: FunctionProps, code: lambda.CfnParametersCode): lambda.FunctionProps => {
    return Object.assign({ code }, defaults, props);
};

const defaults = {
    runtime: lambda.Runtime.GO_1_X,
    handler: 'main',
    tracing: lambda.Tracing.ACTIVE,
};
