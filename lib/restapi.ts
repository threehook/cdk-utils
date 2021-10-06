import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import { addApiKeysToApi, ApiKeyDescr } from './api_keys';
import { ISecret } from "@aws-cdk/aws-secretsmanager";
import { ProxyParameter, backendRequestParamsFor, acceptRequestParamsFor, requestTemplatesFor, unique, parametersFromPath } from './proxyparameter';

export interface RestApiProps {
    name: string;
    stage: string;
    corsAllowOrigin?: string;
    authorizer?: apigateway.IAuthorizer;
    apiKeySourceType?: apigateway.ApiKeySourceType;
    apiKeys?: ApiKeyDescr[];
    proxyRoot?: string;
}

export class RestApi extends cdk.Construct {
    readonly api: apigateway.RestApi;
    readonly authorizer?: apigateway.IAuthorizer;
    readonly proxyRoot: string;

    static apiProps(props: RestApiProps): apigateway.RestApiProps {
        return {
            defaultCorsPreflightOptions: props.corsAllowOrigin ? {
                allowOrigins: [props.corsAllowOrigin],
                allowHeaders: ['Authorization,Content-Type'],
            } : undefined,
            defaultMethodOptions: {
                apiKeyRequired: (props.apiKeys !== undefined && props.apiKeys.length > 0),
            },
            apiKeySourceType: props.apiKeySourceType,
            deployOptions: {
                tracingEnabled: true,
                stageName: props.stage,
            },
            endpointConfiguration: {
                types: [apigateway.EndpointType.REGIONAL]
            },
            restApiName: props.name,
        };
    }

    constructor(scope: cdk.Construct, id: string, props: RestApiProps) {
        super(scope, id);

        this.api = new apigateway.RestApi(this, 'Api', RestApi.apiProps(props));
        if (props.apiKeys) {
            addApiKeysToApi(this.api, props.apiKeys)
        }

        this.authorizer = props.authorizer

        this.proxyRoot = props.proxyRoot ? props.proxyRoot : '/api';

        if (props.corsAllowOrigin) {
            this.newGatewayResponse(apigateway.ResponseType.DEFAULT_4XX, props.corsAllowOrigin);
            this.newGatewayResponse(apigateway.ResponseType.DEFAULT_5XX, props.corsAllowOrigin);
        }
    }

    get root(): apigateway.IResource {
        return this.api.root;
    }

    newGatewayResponse(type: apigateway.ResponseType, corsAllowOrigin: string): apigateway.GatewayResponse {
        return this.api.addGatewayResponse(`GatewayResponse${type.responseType}`, {
            type,
            responseHeaders: {
                'Access-Control-Allow-Origin': constParam(corsAllowOrigin),
                'Access-Control-Allow-Headers': constParam('Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'),
                'Access-Control-Allow-Methods': constParam('OPTIONS'),
            }
        });
    }

    withFunctionOn(path: string, method: string, fct: lambda.Function): void {
        let options: apigateway.MethodOptions = {}
        if (this.authorizer) {
            options = {
                authorizer: this.authorizer
            }
        }
        this.root.resourceForPath(path).addMethod(method, new apigateway.LambdaIntegration(fct), options);
    }

    withProxyOn(path: string, method: string, serverSecret: ISecret, params: ProxyParameter[]): void {
        const allParams = unique(params.concat(parametersFromPath(path)));
        this.root.resourceForPath(this.proxyRoot + path).addMethod(method, new apigateway.HttpIntegration(baseProxyUrl(serverSecret) + path, {
            httpMethod: method,
            proxy: false,
            options: {
                requestParameters: withAPIKey(backendRequestParamsFor(allParams), serverSecret),
                requestTemplates: requestTemplatesFor(allParams),
                integrationResponses: integrationResponses(),
                passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
            }
        }), {
            authorizationType: apigateway.AuthorizationType.CUSTOM,
            authorizer: this.authorizer,
            requestParameters: acceptRequestParamsFor(allParams),
            methodResponses: methodResponses(),
        })
    };
}


function baseProxyUrl(secret: ISecret): string {
    return secret.secretValueFromJson('url').toString()
}

function integrationResponses(): apigateway.IntegrationResponse[] {
    return supportedResponses.map(integrationResponseFor);
}

function methodResponses(): apigateway.MethodResponse[] {
    return supportedResponses.map((statusCode: number) => {
        return { statusCode: statusCode.toString(10) };
    })
}

function integrationResponseFor(statusCode: number): apigateway.IntegrationResponse {
    const statusCodeStr = statusCode.toString(10)
    return {
        statusCode: statusCodeStr,
        selectionPattern: statusCodeStr,//TODO verify that cors is not necessary because of defaultCorsPreflightOptions
    }
}

function withAPIKey(requestParams: { [name: string]: string }, apiKeySecret: ISecret): { [name: string]: string } {
    requestParams['integration.request.header.X-API-Key'] = constParam(apiKeySecret.secretValueFromJson('apiKey').toString())
    return requestParams;
}


export function constParam(parameter: string): string {
    return `'${parameter}'`;
}

const supportedResponses = [200, 201, 202, 204, 400, 401, 403, 404, 405, 406, 408, 409, 412, 413, 422, 425, 428, 429, 500, 501, 502, 503, 504];
