import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as iam from "@aws-cdk/aws-iam";
import * as s3 from '@aws-cdk/aws-s3';
import * as lambda from '@aws-cdk/aws-lambda';
import { ApiKeyDescr } from './api_keys';
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
export declare class ServiceApi extends cdk.Construct {
    readonly api: apigateway.RestApi;
    apiProps(props: ServiceApiProps): apigateway.RestApiProps;
    constructor(scope: cdk.Construct, id: string, props: ServiceApiProps);
    get root(): apigateway.IResource;
    withFunctionOn(path: string, method: string, fct: lambda.Function): void;
    withS3ProxyOn(path: string, method: string, bucket: s3.IBucket, objectKey: string, credentialsRole: iam.Role): void;
}
