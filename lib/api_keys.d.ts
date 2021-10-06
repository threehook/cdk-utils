import * as apigateway from "@aws-cdk/aws-apigateway";
export interface ApiKeyDescr {
    readonly name: string;
    readonly id?: string;
    readonly throttle?: apigateway.ThrottleSettings;
}
/**
 * addApiKeysToApi will add the provided API keys to the api with usage plan.
 */
export declare function addApiKeysToApi(api: apigateway.RestApi, apiKeys: ApiKeyDescr[]): void;
