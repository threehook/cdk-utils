import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import * as iam from "@aws-cdk/aws-iam"
import * as route53 from '@aws-cdk/aws-route53';
import * as s3 from '@aws-cdk/aws-s3'
import * as targets from '@aws-cdk/aws-route53-targets/lib';
import * as lambda from '@aws-cdk/aws-lambda';
import { addApiKeysToApi, ApiKeyDescr } from './api_keys';
import { backendRequestParamsFor, acceptRequestParamsFor, parametersFromPath } from './proxyparameter';

export interface ServiceApiProps {
    readonly name: string;
    readonly stage: string;
    readonly apiKeys: ApiKeyDescr[];
    readonly url: ServiceUrl;
    readonly binaryMediaTypes?: string[];
}

export interface ServiceUrl {
    readonly domain: string;
    readonly subdomain: string;
    readonly certificateArn: string;
}

export class ServiceApi extends cdk.Construct {
    readonly api: apigateway.RestApi;

    apiProps(props: ServiceApiProps): apigateway.RestApiProps {
        return {
            apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
            binaryMediaTypes: props.binaryMediaTypes,
            deployOptions: {
                tracingEnabled: true,
                stageName: props.stage,
            },
            defaultMethodOptions: {
                apiKeyRequired: true,
            },
            endpointConfiguration: {
                types: [apigateway.EndpointType.REGIONAL]
            },
            restApiName: props.name,
            domainName: {
                domainName: fullSubdomainName(props.url),
                certificate: Certificate.fromCertificateArn(this, 'Certificate', props.url.certificateArn),
            },
        };
    }

    constructor(scope: cdk.Construct, id: string, props: ServiceApiProps) {
        super(scope, id);

        this.api = new apigateway.RestApi(this, "Api", this.apiProps(props));

        addApiKeysToApi(this.api, props.apiKeys)

        aRecordFor(this, props.url, this.api);
    }

    get root(): apigateway.IResource {
        return this.api.root;
    }

    withFunctionOn(path: string, method: string, fct: lambda.Function): void {
        this.root.resourceForPath(path).addMethod(method, new apigateway.LambdaIntegration(fct));
    }

    withS3ProxyOn(path: string, method: string, bucket: s3.IBucket, objectKey: string, credentialsRole: iam.Role): void {
        const params = parametersFromPath(path);
        this.root.resourceForPath(path).addMethod(method, new apigateway.AwsIntegration({
            service: "s3",
            integrationHttpMethod: method,
            path: `${bucket.bucketName}${objectKey}`,
            options: {
                credentialsRole,
                requestParameters: backendRequestParamsFor(params),
                passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
                integrationResponses: [
                    {
                        statusCode: '200',
                        selectionPattern: '200',
                        responseParameters: {
                            "method.response.header.Content-Type": "integration.response.header.Content-Type",
                            "method.response.header.Content-Length": "integration.response.header.Content-Length",
                        }
                    },
                    {
                        statusCode: '400',
                        selectionPattern: '3??',
                        responseParameters: {
                            "method.response.header.Content-Type": "integration.response.header.Content-Type",
                        }
                    },
                    {
                        statusCode: '404',
                        selectionPattern: '404',
                        responseParameters: {
                            "method.response.header.Content-Type": "integration.response.header.Content-Type",
                        }
                    },
                    {
                        statusCode: '400',
                        selectionPattern: '4??',
                        responseParameters: {
                            "method.response.header.Content-Type": "integration.response.header.Content-Type",
                        }
                    },
                    {
                        statusCode: '500',
                        selectionPattern: '5??',
                        responseParameters: {
                            "method.response.header.Content-Type": "integration.response.header.Content-Type",
                        }
                    },
                ]
            }
        }), {
            methodResponses: [
                {
                    statusCode: "200",
                    responseParameters: {
                        "method.response.header.Content-Type": true,
                        "method.response.header.Content-Length": true,
                    },
                },
                {
                    statusCode: "400",
                    responseParameters: {
                        "method.response.header.Content-Type": true,
                    },
                },
                {
                    statusCode: "404",
                    responseParameters: {
                        "method.response.header.Content-Type": true,
                    },
                },
                {
                    statusCode: "500",
                    responseParameters: {
                        "method.response.header.Content-Type": true,
                    },
                },
            ],
            requestParameters: acceptRequestParamsFor(params),
        });
    }


}

function aRecordFor(scope: cdk.Construct, url: ServiceUrl, api: apigateway.RestApi): route53.ARecord {
    return new route53.ARecord(scope, 'ApiAliasRecord', {
        recordName: fullSubdomainName(url),
        target: route53.RecordTarget.fromAlias(new targets.ApiGateway(api)),
        zone: route53.HostedZone.fromLookup(scope, 'Zone', { domainName: url.domain }),
    });
}

function fullSubdomainName(url: ServiceUrl): string {
    if (url.subdomain === '') {
        return url.domain;
    }
    return url.subdomain + '.' + url.domain;
}
