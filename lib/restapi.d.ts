import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import { ApiKeyDescr } from './api_keys';
import { ISecret } from "@aws-cdk/aws-secretsmanager";
import { ProxyParameter } from './proxyparameter';
export interface RestApiProps {
    name: string;
    stage: string;
    corsAllowOrigin?: string;
    authorizer?: apigateway.IAuthorizer;
    apiKeySourceType?: apigateway.ApiKeySourceType;
    apiKeys?: ApiKeyDescr[];
    proxyRoot?: string;
}
export declare class RestApi extends cdk.Construct {
    readonly api: apigateway.RestApi;
    readonly authorizer?: apigateway.IAuthorizer;
    readonly proxyRoot: string;
    static apiProps(props: RestApiProps): apigateway.RestApiProps;
    constructor(scope: cdk.Construct, id: string, props: RestApiProps);
    get root(): apigateway.IResource;
    newGatewayResponse(type: apigateway.ResponseType, corsAllowOrigin: string): apigateway.GatewayResponse;
    withFunctionOn(path: string, method: string, fct: lambda.Function): void;
    withProxyOn(path: string, method: string, serverSecret: ISecret, params: ProxyParameter[]): void;
}
export declare function constParam(parameter: string): string;
