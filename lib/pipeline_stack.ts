import {App, Construct, Stack, StackProps, Tags} from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';


export interface PipelineStackProps extends StackProps {
    readonly tags: {
        Application: string;
        Stage: string;
    }
    readonly serviceStack: Stack;
    readonly repository: {
        readonly name: string;
        readonly branch: string;
    }
    readonly artifactBucketName: string;
    readonly languages: string[];
    readonly packageName?: string;
    readonly buildSecretArns?: string[];
    readonly buildRolePolicy?: iam.PolicyStatement[];
    readonly bitbucketConnectionSecretName?: string;
    readonly commands?: Command[];
}

export class PipelineStack extends Stack {
    constructor(app: App, id: string, props: PipelineStackProps) {
        super(app, id, props);

        const {tags, serviceStack, repository, bitbucketConnectionSecretName} = props;
        const packageName = props.packageName ? props.packageName : props.repository.name;
        const srcDirPrefix = '/tmp/go/src/bitbucket.org/persgroep';
        const srcDir = `${srcDirPrefix}/${packageName}`;
        const {region, account} = props.env ? props.env : {region: 'eu-west-1', account: '769369456184'};

        const bitbucketAccessParameterName = 'build-bitbucket-access';
        const bitbucketAccessParameterArn = `arn:aws:ssm:${region}:${account}:parameter/${bitbucketAccessParameterName}`;

        const artifactBucket = s3.Bucket.fromBucketName(this, 'ArtifactBucket', props.artifactBucketName);

        const commands = commandsFor(props.languages).concat(props.commands ?? []);

        const sourceOutput = new codepipeline.Artifact();
        const buildOutput = new codepipeline.Artifact();

        const serviceBuild = new codebuild.PipelineProject(this, 'Build', {
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                env: {
                    'parameter-store': {
                        'build_bitbucket_access': `${bitbucketAccessParameterName}`,
                    },
                    variables: {
                        'GOOS': 'linux',
                        'GO111MODULE': 'on',
                        'GOPATH': '/tmp/go',
                    },
                },
                phases: {
                    install: {
                        'runtime-versions': runtimeVersions(commands),
                        commands: [
                            'npm install -g npm@latest',
                            `mkdir -p ${srcDirPrefix}`,
                            `ln -s $CODEBUILD_SRC_DIR ${srcDir}`,
                            'mkdir -p ~/.ssh',
                            'echo "$build_bitbucket_access" > ~/.ssh/id_rsa',
                            'chmod 400 ~/.ssh/id_rsa',
                            'git config --global url."git@bitbucket.org:".insteadOf "https://bitbucket.org/"',
                            'cd $CODEBUILD_SRC_DIR/ops',
                            'npm install',
                            `cd ${srcDir}`,
                            ...installCommands(commands),
                        ],
                    },
                    build: {
                        commands: [
                            'cd $CODEBUILD_SRC_DIR/ops',
                            'npm run build',
                            'npm run test',
                            `npm run cdk synthesize`,
                            `cd ${srcDir}`,
                            ...buildCommands(commands),
                            ...codeCoverageCommands(commands),
                            `./ops/node_modules/.bin/deploycode -v -i=$CODEBUILD_SRC_DIR/ops/cdk.out/${serviceStack.stackName}.template.json -b=${artifactBucket.bucketName} -o=$CODEBUILD_SRC_DIR/ops/cdk.out/${serviceStack.stackName}.deployed.template.json`,
                            `echo '${encodeSingleQuote(JSON.stringify(templateConfigurationFor(tags)))}' > $CODEBUILD_SRC_DIR/ops/cdk.out/template.config.json`,
                        ],
                    },
                },
                artifacts: {
                    'base-directory': 'ops/cdk.out',
                    'files': [`${serviceStack.stackName}.deployed.template.json`, 'template.config.json'],
                },
                reports: {
                    codeCoverage: {
                        'files': 'coverage.xml',
                        'file-format': 'COBERTURAXML'
                    }
                }

            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
                computeType: codebuild.ComputeType.MEDIUM,
            },
            grantReportGroupPermissions : true
        });
        serviceBuild.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ssm:Describe*', 'ssm:Get*'],
            resources: [bitbucketAccessParameterArn],
        }));
        if (props.buildSecretArns) {
            serviceBuild.addToRolePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
                resources: props.buildSecretArns.map(s => secretsmanager.Secret.fromSecretNameV2(this, s, s).secretArn + '-??????'),
            }));
        }
        if (props.buildRolePolicy) {
            props.buildRolePolicy.forEach(buildRolePolicyStatement => {
                serviceBuild.addToRolePolicy(buildRolePolicyStatement)
            });
        }
        serviceBuild.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ec2:DescribeAvailabilityZones'],
            resources: ['*'],
        }));
        serviceBuild.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['route53:ListHostedZonesByName'],
            resources: ['*'],
        }))

        artifactBucket.grantReadWrite(serviceBuild);

        let sourceAction, codestarConnectionArnToUse;
        if (bitbucketConnectionSecretName) {
            const bitbucketConnectionSecret = secretsmanager.Secret.fromSecretNameV2(this, 'BitbucketConnectionSecret', bitbucketConnectionSecretName);
            codestarConnectionArnToUse = bitbucketConnectionSecret.secretValueFromJson('connectionArn').toString()
            sourceAction = new codepipeline_actions.BitBucketSourceAction({
                actionName: 'Source',
                connectionArn: codestarConnectionArnToUse,
                owner: bitbucketConnectionSecret.secretValueFromJson('owner').toString(),
                repo: repository.name,
                branch: repository.branch,
                output: sourceOutput,
            });

        } else {
            sourceAction = new codepipeline_actions.CodeCommitSourceAction({
                actionName: 'Source',
                repository: codecommit.Repository.fromRepositoryName(this, 'Repo', repository.name),
                branch: repository.branch,
                output: sourceOutput,
            });
        }

        const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
            stages: [
                {
                    stageName: 'Source',
                    actions: [
                        sourceAction
                    ],
                },
                {
                    stageName: 'Build',
                    actions: [
                        new codepipeline_actions.CodeBuildAction({
                            actionName: 'Build',
                            project: serviceBuild,
                            input: sourceOutput,
                            outputs: [buildOutput],
                        }),
                    ],
                },
                {
                    stageName: 'Deploy',
                    actions: [
                        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
                            actionName: 'Deploy',
                            templatePath: buildOutput.atPath(`${serviceStack.stackName}.deployed.template.json`),
                            templateConfiguration: buildOutput.atPath(`template.config.json`),
                            stackName: serviceStack.stackName,
                            adminPermissions: true,
                        })
                    ]
                }
            ],
            artifactBucket: artifactBucket,
        });
        if (codestarConnectionArnToUse) {
            pipeline.addToRolePolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['codestar-connections:UseConnection'],
                resources: [codestarConnectionArnToUse],
            }));
        }

        ensureTags(this, tags)
        ensureTags(props.serviceStack, tags)
    }
}

export interface Command {
    runtimeVersion: { [key: string]: string };
    install?: string;
    build?: string;
    cover?: string;
}

function commandsFor(languages: string[]): Command[] {
    return languages.map(language => {
        return commandFor(language);
    })
}

function commandFor(language: string): Command {
    switch (language) {
        case 'golang':
            return {
                runtimeVersion: {golang: '1.15'},
                install: 'go get github.com/axw/gocov/gocov github.com/AlekSi/gocov-xml',
                build: './ops/node_modules/.bin/build-go-functions.sh ',
                cover: 'rm -Rf ./ops/node_modules/aws-cdk/lib/init-templates/v* && GO_TEST=true go test ./... -coverprofile=cover.out -coverpkg=./... && /tmp/go/bin/gocov convert cover.out | /tmp/go/bin/gocov-xml > coverage.xml'
            };
        case 'nodejs':
            return {
                runtimeVersion: {nodejs: '14'},
                install: './ops/node_modules/.bin/install-node-dependencies.sh && ./ops/node_modules/.bin/link-typescript-layers.sh',
                build: 'npm run build && npm run test && ./ops/node_modules/.bin/prune-node-non-prod-dependencies.sh',
            };
    }
    return {
        runtimeVersion: {},
    }
}

function runtimeVersions(commands: Command[]): { [key: string]: string } {
    let value = {};
    commands.forEach(command => {
        Object.assign(value, command.runtimeVersion);
    });
    return value
}

function buildCommands(commands: Command[]): string[] {
    let value: string[] = [];
    commands.forEach((command: Command) => {
        if (command.build) {
            value.push(command.build);
        }
    });
    return value
}

function codeCoverageCommands(commands: Command[]): string[] {
    let value: string[] = [];
    commands.forEach((command: Command) => {
        if (command.cover) {
            value.push(command.cover);
        }
    });
    return value
}

function installCommands(commands: Command[]): string[] {
    let value: string[] = [];
    commands.forEach((command: Command) => {
        if (command.install) {
            value.push(command.install);
        }
    });
    return value
}

function templateConfigurationFor(tags: Record<string, string>): { Tags: Record<string, string> } {
    return {
        Tags: tags,
    }
}

function encodeSingleQuote(str: string): string {
    return str.replace("'", "'\''")
}

function ensureTags(scope: Construct, tags: Record<string, string>) {
    for (const key in tags) {
        Tags.of(scope).add(key, tags[key])
    }
}
