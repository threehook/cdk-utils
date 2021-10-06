import { App, Stack, StackProps } from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
export interface PipelineStackProps extends StackProps {
    readonly tags: {
        Application: string;
        Stage: string;
    };
    readonly serviceStack: Stack;
    readonly repository: {
        readonly name: string;
        readonly branch: string;
    };
    readonly artifactBucketName: string;
    readonly languages: string[];
    readonly packageName?: string;
    readonly buildSecretArns?: string[];
    readonly buildRolePolicy?: iam.PolicyStatement[];
    readonly bitbucketConnectionSecretName?: string;
    readonly commands?: Command[];
}
export declare class PipelineStack extends Stack {
    constructor(app: App, id: string, props: PipelineStackProps);
}
export interface Command {
    runtimeVersion: {
        [key: string]: string;
    };
    install?: string;
    build?: string;
    cover?: string;
}
