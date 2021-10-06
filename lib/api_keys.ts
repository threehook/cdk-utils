import * as apigateway from "@aws-cdk/aws-apigateway";

export interface ApiKeyDescr {
    readonly name: string;
    readonly id?: string; // Deprecated
    readonly throttle?: apigateway.ThrottleSettings;
}

/**
 * addApiKeysToApi will add the provided API keys to the api with usage plan.
 */
export function addApiKeysToApi(api: apigateway.RestApi, apiKeys: ApiKeyDescr[]) {
    apiKeys.forEach((descr: ApiKeyDescr) => {
        const apiKey = api.addApiKey(`ApiKey-${descr.name}`, {
            apiKeyName: descr.name,
        })
        const usagePlan = api.addUsagePlan(`UsagePlan-${descr.name}`, {
            name: descr.name,
            apiKey: apiKey,
            throttle: descr.throttle ? descr.throttle : {
                rateLimit: 500,
                burstLimit: 750,
            }
        })
        usagePlan.addApiStage({
            stage: api.deploymentStage,
        })

    });
}
