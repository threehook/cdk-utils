"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineStack = void 0;
const core_1 = require("@aws-cdk/core");
const codebuild = require("@aws-cdk/aws-codebuild");
const codecommit = require("@aws-cdk/aws-codecommit");
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
const iam = require("@aws-cdk/aws-iam");
const s3 = require("@aws-cdk/aws-s3");
const secretsmanager = require("@aws-cdk/aws-secretsmanager");
class PipelineStack extends core_1.Stack {
    constructor(app, id, props) {
        var _a;
        super(app, id, props);
        const { tags, serviceStack, repository, bitbucketConnectionSecretName } = props;
        const packageName = props.packageName ? props.packageName : props.repository.name;
        const srcDirPrefix = '/tmp/go/src/bitbucket.org/persgroep';
        const srcDir = `${srcDirPrefix}/${packageName}`;
        const { region, account } = props.env ? props.env : { region: 'eu-west-1', account: '769369456184' };
        const bitbucketAccessParameterName = 'build-bitbucket-access';
        const bitbucketAccessParameterArn = `arn:aws:ssm:${region}:${account}:parameter/${bitbucketAccessParameterName}`;
        const artifactBucket = s3.Bucket.fromBucketName(this, 'ArtifactBucket', props.artifactBucketName);
        const commands = commandsFor(props.languages).concat((_a = props.commands) !== null && _a !== void 0 ? _a : []);
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
            grantReportGroupPermissions: true
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
                serviceBuild.addToRolePolicy(buildRolePolicyStatement);
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
        }));
        artifactBucket.grantReadWrite(serviceBuild);
        let sourceAction, codestarConnectionArnToUse;
        if (bitbucketConnectionSecretName) {
            const bitbucketConnectionSecret = secretsmanager.Secret.fromSecretNameV2(this, 'BitbucketConnectionSecret', bitbucketConnectionSecretName);
            codestarConnectionArnToUse = bitbucketConnectionSecret.secretValueFromJson('connectionArn').toString();
            sourceAction = new codepipeline_actions.BitBucketSourceAction({
                actionName: 'Source',
                connectionArn: codestarConnectionArnToUse,
                owner: bitbucketConnectionSecret.secretValueFromJson('owner').toString(),
                repo: repository.name,
                branch: repository.branch,
                output: sourceOutput,
            });
        }
        else {
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
        ensureTags(this, tags);
        ensureTags(props.serviceStack, tags);
    }
}
exports.PipelineStack = PipelineStack;
function commandsFor(languages) {
    return languages.map(language => {
        return commandFor(language);
    });
}
function commandFor(language) {
    switch (language) {
        case 'golang':
            return {
                runtimeVersion: { golang: '1.15' },
                install: 'go get github.com/axw/gocov/gocov github.com/AlekSi/gocov-xml',
                build: './ops/node_modules/.bin/build-go-functions.sh ',
                cover: 'rm -Rf ./ops/node_modules/aws-cdk/lib/init-templates/v* && GO_TEST=true go test ./... -coverprofile=cover.out -coverpkg=./... && /tmp/go/bin/gocov convert cover.out | /tmp/go/bin/gocov-xml > coverage.xml'
            };
        case 'nodejs':
            return {
                runtimeVersion: { nodejs: '14' },
                install: './ops/node_modules/.bin/install-node-dependencies.sh && ./ops/node_modules/.bin/link-typescript-layers.sh',
                build: 'npm run build && npm run test && ./ops/node_modules/.bin/prune-node-non-prod-dependencies.sh',
            };
    }
    return {
        runtimeVersion: {},
    };
}
function runtimeVersions(commands) {
    let value = {};
    commands.forEach(command => {
        Object.assign(value, command.runtimeVersion);
    });
    return value;
}
function buildCommands(commands) {
    let value = [];
    commands.forEach((command) => {
        if (command.build) {
            value.push(command.build);
        }
    });
    return value;
}
function codeCoverageCommands(commands) {
    let value = [];
    commands.forEach((command) => {
        if (command.cover) {
            value.push(command.cover);
        }
    });
    return value;
}
function installCommands(commands) {
    let value = [];
    commands.forEach((command) => {
        if (command.install) {
            value.push(command.install);
        }
    });
    return value;
}
function templateConfigurationFor(tags) {
    return {
        Tags: tags,
    };
}
function encodeSingleQuote(str) {
    return str.replace("'", "'\''");
}
function ensureTags(scope, tags) {
    for (const key in tags) {
        core_1.Tags.of(scope).add(key, tags[key]);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmVfc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwaXBlbGluZV9zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx3Q0FBc0U7QUFDdEUsb0RBQW9EO0FBQ3BELHNEQUFzRDtBQUN0RCwwREFBMEQ7QUFDMUQsMEVBQTBFO0FBQzFFLHdDQUF3QztBQUN4QyxzQ0FBc0M7QUFDdEMsOERBQThEO0FBc0I5RCxNQUFhLGFBQWMsU0FBUSxZQUFLO0lBQ3BDLFlBQVksR0FBUSxFQUFFLEVBQVUsRUFBRSxLQUF5Qjs7UUFDdkQsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFdEIsTUFBTSxFQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLDZCQUE2QixFQUFDLEdBQUcsS0FBSyxDQUFDO1FBQzlFLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1FBQ2xGLE1BQU0sWUFBWSxHQUFHLHFDQUFxQyxDQUFDO1FBQzNELE1BQU0sTUFBTSxHQUFHLEdBQUcsWUFBWSxJQUFJLFdBQVcsRUFBRSxDQUFDO1FBQ2hELE1BQU0sRUFBQyxNQUFNLEVBQUUsT0FBTyxFQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBQyxNQUFNLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxjQUFjLEVBQUMsQ0FBQztRQUVqRyxNQUFNLDRCQUE0QixHQUFHLHdCQUF3QixDQUFDO1FBQzlELE1BQU0sMkJBQTJCLEdBQUcsZUFBZSxNQUFNLElBQUksT0FBTyxjQUFjLDRCQUE0QixFQUFFLENBQUM7UUFFakgsTUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENB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Q0FBQztJQUN6QixRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBZ0IsRUFBRSxFQUFFO1FBQ2xDLElBQUksT0FBTyxDQUFDLEtBQUssRUFBRTtZQUNmLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQzdCO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLEtBQUssQ0FBQTtBQUNoQixDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsUUFBbUI7SUFDeEMsSUFBSSxLQUFLLEdBQWEsRUFBRSxDQUFDO0lBQ3pCLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFnQixFQUFFLEVBQUU7UUFDbEMsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFO1lBQ2pCLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQy9CO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLEtBQUssQ0FBQTtBQUNoQixDQUFDO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxJQUE0QjtJQUMxRCxPQUFPO1FBQ0gsSUFBSSxFQUFFLElBQUk7S0FDYixDQUFBO0FBQ0wsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsR0FBVztJQUNsQyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFBO0FBQ25DLENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxLQUFnQixFQUFFLElBQTRCO0lBQzlELEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1FBQ3BCLFdBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtLQUNyQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0FwcCwgQ29uc3RydWN0LCBTdGFjaywgU3RhY2tQcm9wcywgVGFnc30gZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyBjb2RlYnVpbGQgZnJvbSAnQGF3cy1jZGsvYXdzLWNvZGVidWlsZCc7XG5pbXBvcnQgKiBhcyBjb2RlY29tbWl0IGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlY29tbWl0JztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZSBmcm9tICdAYXdzLWNkay9hd3MtY29kZXBpcGVsaW5lJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZV9hY3Rpb25zIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnQGF3cy1jZGsvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnQGF3cy1jZGsvYXdzLXNlY3JldHNtYW5hZ2VyJztcblxuXG5leHBvcnQgaW50ZXJmYWNlIFBpcGVsaW5lU3RhY2tQcm9wcyBleHRlbmRzIFN0YWNrUHJvcHMge1xuICAgIHJlYWRvbmx5IHRhZ3M6IHtcbiAgICAgICAgQXBwbGljYXRpb246IHN0cmluZztcbiAgICAgICAgU3RhZ2U6IHN0cmluZztcbiAgICB9XG4gICAgcmVhZG9ubHkgc2VydmljZVN0YWNrOiBTdGFjaztcbiAgICByZWFkb25seSByZXBvc2l0b3J5OiB7XG4gICAgICAgIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgICAgICAgcmVhZG9ubHkgYnJhbmNoOiBzdHJpbmc7XG4gICAgfVxuICAgIHJlYWRvbmx5IGFydGlmYWN0QnVja2V0TmFtZTogc3RyaW5nO1xuICAgIHJlYWRvbmx5IGxhbmd1YWdlczogc3RyaW5nW107XG4gICAgcmVhZG9ubHkgcGFja2FnZU5hbWU/OiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgYnVpbGRTZWNyZXRBcm5zPzogc3RyaW5nW107XG4gICAgcmVhZG9ubHkgYnVpbGRSb2xlUG9saWN5PzogaWFtLlBvbGljeVN0YXRlbWVudFtdO1xuICAgIHJlYWRvbmx5IGJpdGJ1Y2tldENvbm5lY3Rpb25TZWNyZXROYW1lPzogc3RyaW5nO1xuICAgIHJlYWRvbmx5IGNvbW1hbmRzPzogQ29tbWFuZFtdO1xufVxuXG5leHBvcnQgY2xhc3MgUGlwZWxpbmVTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgaWQ6IHN0cmluZywgcHJvcHM6IFBpcGVsaW5lU3RhY2tQcm9wcykge1xuICAgICAgICBzdXBlcihhcHAsIGlkLCBwcm9wcyk7XG5cbiAgICAgICAgY29uc3Qge3RhZ3MsIHNlcnZpY2VTdGFjaywgcmVwb3NpdG9yeSwgYml0YnVja2V0Q29ubmVjdGlvblNlY3JldE5hbWV9ID0gcHJvcHM7XG4gICAgICAgIGNvbnN0IHBhY2thZ2VOYW1lID0gcHJvcHMucGFja2FnZU5hbWUgPyBwcm9wcy5wYWNrYWdlTmFtZSA6IHByb3BzLnJlcG9zaXRvcnkubmFtZTtcbiAgICAgICAgY29uc3Qgc3JjRGlyUHJlZml4ID0gJy90bXAvZ28vc3JjL2JpdGJ1Y2tldC5vcmcvcGVyc2dyb2VwJztcbiAgICAgICAgY29uc3Qgc3JjRGlyID0gYCR7c3JjRGlyUHJlZml4fS8ke3BhY2thZ2VOYW1lfWA7XG4gICAgICAgIGNvbnN0IHtyZWdpb24sIGFjY291bnR9ID0gcHJvcHMuZW52ID8gcHJvcHMuZW52IDoge3JlZ2lvbjogJ2V1LXdlc3QtMScsIGFjY291bnQ6ICc3NjkzNjk0NTYxODQnfTtcblxuICAgICAgICBjb25zdCBiaXRidWNrZXRBY2Nlc3NQYXJhbWV0ZXJOYW1lID0gJ2J1aWxkLWJpdGJ1Y2tldC1hY2Nlc3MnO1xuICAgICAgICBjb25zdCBiaXRidWNrZXRBY2Nlc3NQYXJhbWV0ZXJBcm4gPSBgYXJuOmF3czpzc206JHtyZWdpb259OiR7YWNjb3VudH06cGFyYW1ldGVyLyR7Yml0YnVja2V0QWNjZXNzUGFyYW1ldGVyTmFtZX1gO1xuXG4gICAgICAgIGNvbnN0IGFydGlmYWN0QnVja2V0ID0gczMuQnVja2V0LmZyb21CdWNrZXROYW1lKHRoaXMsICdBcnRpZmFjdEJ1Y2tldCcsIHByb3BzLmFydGlmYWN0QnVja2V0TmFtZSk7XG5cbiAgICAgICAgY29uc3QgY29tbWFuZHMgPSBjb21tYW5kc0Zvcihwcm9wcy5sYW5ndWFnZXMpLmNvbmNhdChwcm9wcy5jb21tYW5kcyA/PyBbXSk7XG5cbiAgICAgICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgpO1xuICAgICAgICBjb25zdCBidWlsZE91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcblxuICAgICAgICBjb25zdCBzZXJ2aWNlQnVpbGQgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdCh0aGlzLCAnQnVpbGQnLCB7XG4gICAgICAgICAgICBidWlsZFNwZWM6IGNvZGVidWlsZC5CdWlsZFNwZWMuZnJvbU9iamVjdCh7XG4gICAgICAgICAgICAgICAgdmVyc2lvbjogJzAuMicsXG4gICAgICAgICAgICAgICAgZW52OiB7XG4gICAgICAgICAgICAgICAgICAgICdwYXJhbWV0ZXItc3RvcmUnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnYnVpbGRfYml0YnVja2V0X2FjY2Vzcyc6IGAke2JpdGJ1Y2tldEFjY2Vzc1BhcmFtZXRlck5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnR09PUyc6ICdsaW51eCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnR08xMTFNT0RVTEUnOiAnb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0dPUEFUSCc6ICcvdG1wL2dvJyxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBoYXNlczoge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YWxsOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAncnVudGltZS12ZXJzaW9ucyc6IHJ1bnRpbWVWZXJzaW9ucyhjb21tYW5kcyksXG4gICAgICAgICAgICAgICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICducG0gaW5zdGFsbCAtZyBucG1AbGF0ZXN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgbWtkaXIgLXAgJHtzcmNEaXJQcmVmaXh9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgbG4gLXMgJENPREVCVUlMRF9TUkNfRElSICR7c3JjRGlyfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ21rZGlyIC1wIH4vLnNzaCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2VjaG8gXCIkYnVpbGRfYml0YnVja2V0X2FjY2Vzc1wiID4gfi8uc3NoL2lkX3JzYScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NobW9kIDQwMCB+Ly5zc2gvaWRfcnNhJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZ2l0IGNvbmZpZyAtLWdsb2JhbCB1cmwuXCJnaXRAYml0YnVja2V0Lm9yZzpcIi5pbnN0ZWFkT2YgXCJodHRwczovL2JpdGJ1Y2tldC5vcmcvXCInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjZCAkQ09ERUJVSUxEX1NSQ19ESVIvb3BzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbnBtIGluc3RhbGwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBjZCAke3NyY0Rpcn1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLmluc3RhbGxDb21tYW5kcyhjb21tYW5kcyksXG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY2QgJENPREVCVUlMRF9TUkNfRElSL29wcycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ25wbSBydW4gYnVpbGQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICducG0gcnVuIHRlc3QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBucG0gcnVuIGNkayBzeW50aGVzaXplYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBgY2QgJHtzcmNEaXJ9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi5idWlsZENvbW1hbmRzKGNvbW1hbmRzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi5jb2RlQ292ZXJhZ2VDb21tYW5kcyhjb21tYW5kcyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYC4vb3BzL25vZGVfbW9kdWxlcy8uYmluL2RlcGxveWNvZGUgLXYgLWk9JENPREVCVUlMRF9TUkNfRElSL29wcy9jZGsub3V0LyR7c2VydmljZVN0YWNrLnN0YWNrTmFtZX0udGVtcGxhdGUuanNvbiAtYj0ke2FydGlmYWN0QnVja2V0LmJ1Y2tldE5hbWV9IC1vPSRDT0RFQlVJTERfU1JDX0RJUi9vcHMvY2RrLm91dC8ke3NlcnZpY2VTdGFjay5zdGFja05hbWV9LmRlcGxveWVkLnRlbXBsYXRlLmpzb25gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBlY2hvICcke2VuY29kZVNpbmdsZVF1b3RlKEpTT04uc3RyaW5naWZ5KHRlbXBsYXRlQ29uZmlndXJhdGlvbkZvcih0YWdzKSkpfScgPiAkQ09ERUJVSUxEX1NSQ19ESVIvb3BzL2Nkay5vdXQvdGVtcGxhdGUuY29uZmlnLmpzb25gLFxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGFydGlmYWN0czoge1xuICAgICAgICAgICAgICAgICAgICAnYmFzZS1kaXJlY3RvcnknOiAnb3BzL2Nkay5vdXQnLFxuICAgICAgICAgICAgICAgICAgICAnZmlsZXMnOiBbYCR7c2VydmljZVN0YWNrLnN0YWNrTmFtZX0uZGVwbG95ZWQudGVtcGxhdGUuanNvbmAsICd0ZW1wbGF0ZS5jb25maWcuanNvbiddLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcmVwb3J0czoge1xuICAgICAgICAgICAgICAgICAgICBjb2RlQ292ZXJhZ2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdmaWxlcyc6ICdjb3ZlcmFnZS54bWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2ZpbGUtZm9ybWF0JzogJ0NPQkVSVFVSQVhNTCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfNV8wLFxuICAgICAgICAgICAgICAgIGNvbXB1dGVUeXBlOiBjb2RlYnVpbGQuQ29tcHV0ZVR5cGUuTUVESVVNLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdyYW50UmVwb3J0R3JvdXBQZXJtaXNzaW9ucyA6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHNlcnZpY2VCdWlsZC5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogWydzc206RGVzY3JpYmUqJywgJ3NzbTpHZXQqJ10sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtiaXRidWNrZXRBY2Nlc3NQYXJhbWV0ZXJBcm5dLFxuICAgICAgICB9KSk7XG4gICAgICAgIGlmIChwcm9wcy5idWlsZFNlY3JldEFybnMpIHtcbiAgICAgICAgICAgIHNlcnZpY2VCdWlsZC5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgICBhY3Rpb25zOiBbJ3NlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlJywgJ3NlY3JldHNtYW5hZ2VyOkRlc2NyaWJlU2VjcmV0J10sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBwcm9wcy5idWlsZFNlY3JldEFybnMubWFwKHMgPT4gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIodGhpcywgcywgcykuc2VjcmV0QXJuICsgJy0/Pz8/Pz8nKSxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcHMuYnVpbGRSb2xlUG9saWN5KSB7XG4gICAgICAgICAgICBwcm9wcy5idWlsZFJvbGVQb2xpY3kuZm9yRWFjaChidWlsZFJvbGVQb2xpY3lTdGF0ZW1lbnQgPT4ge1xuICAgICAgICAgICAgICAgIHNlcnZpY2VCdWlsZC5hZGRUb1JvbGVQb2xpY3koYnVpbGRSb2xlUG9saWN5U3RhdGVtZW50KVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgc2VydmljZUJ1aWxkLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBhY3Rpb25zOiBbJ2VjMjpEZXNjcmliZUF2YWlsYWJpbGl0eVpvbmVzJ10sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICB9KSk7XG4gICAgICAgIHNlcnZpY2VCdWlsZC5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgYWN0aW9uczogWydyb3V0ZTUzOkxpc3RIb3N0ZWRab25lc0J5TmFtZSddLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgfSkpXG5cbiAgICAgICAgYXJ0aWZhY3RCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoc2VydmljZUJ1aWxkKTtcblxuICAgICAgICBsZXQgc291cmNlQWN0aW9uLCBjb2Rlc3RhckNvbm5lY3Rpb25Bcm5Ub1VzZTtcbiAgICAgICAgaWYgKGJpdGJ1Y2tldENvbm5lY3Rpb25TZWNyZXROYW1lKSB7XG4gICAgICAgICAgICBjb25zdCBiaXRidWNrZXRDb25uZWN0aW9uU2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIodGhpcywgJ0JpdGJ1Y2tldENvbm5lY3Rpb25TZWNyZXQnLCBiaXRidWNrZXRDb25uZWN0aW9uU2VjcmV0TmFtZSk7XG4gICAgICAgICAgICBjb2Rlc3RhckNvbm5lY3Rpb25Bcm5Ub1VzZSA9IGJpdGJ1Y2tldENvbm5lY3Rpb25TZWNyZXQuc2VjcmV0VmFsdWVGcm9tSnNvbignY29ubmVjdGlvbkFybicpLnRvU3RyaW5nKClcbiAgICAgICAgICAgIHNvdXJjZUFjdGlvbiA9IG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5CaXRCdWNrZXRTb3VyY2VBY3Rpb24oe1xuICAgICAgICAgICAgICAgIGFjdGlvbk5hbWU6ICdTb3VyY2UnLFxuICAgICAgICAgICAgICAgIGNvbm5lY3Rpb25Bcm46IGNvZGVzdGFyQ29ubmVjdGlvbkFyblRvVXNlLFxuICAgICAgICAgICAgICAgIG93bmVyOiBiaXRidWNrZXRDb25uZWN0aW9uU2VjcmV0LnNlY3JldFZhbHVlRnJvbUpzb24oJ293bmVyJykudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICByZXBvOiByZXBvc2l0b3J5Lm5hbWUsXG4gICAgICAgICAgICAgICAgYnJhbmNoOiByZXBvc2l0b3J5LmJyYW5jaCxcbiAgICAgICAgICAgICAgICBvdXRwdXQ6IHNvdXJjZU91dHB1dCxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzb3VyY2VBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUNvbW1pdFNvdXJjZUFjdGlvbih7XG4gICAgICAgICAgICAgICAgYWN0aW9uTmFtZTogJ1NvdXJjZScsXG4gICAgICAgICAgICAgICAgcmVwb3NpdG9yeTogY29kZWNvbW1pdC5SZXBvc2l0b3J5LmZyb21SZXBvc2l0b3J5TmFtZSh0aGlzLCAnUmVwbycsIHJlcG9zaXRvcnkubmFtZSksXG4gICAgICAgICAgICAgICAgYnJhbmNoOiByZXBvc2l0b3J5LmJyYW5jaCxcbiAgICAgICAgICAgICAgICBvdXRwdXQ6IHNvdXJjZU91dHB1dCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGlwZWxpbmUgPSBuZXcgY29kZXBpcGVsaW5lLlBpcGVsaW5lKHRoaXMsICdQaXBlbGluZScsIHtcbiAgICAgICAgICAgIHN0YWdlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2VOYW1lOiAnU291cmNlJyxcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlQWN0aW9uXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YWdlTmFtZTogJ0J1aWxkJyxcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uTmFtZTogJ0J1aWxkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9qZWN0OiBzZXJ2aWNlQnVpbGQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQ6IHNvdXJjZU91dHB1dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRzOiBbYnVpbGRPdXRwdXRdLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YWdlTmFtZTogJ0RlcGxveScsXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5DbG91ZEZvcm1hdGlvbkNyZWF0ZVVwZGF0ZVN0YWNrQWN0aW9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb25OYW1lOiAnRGVwbG95JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZVBhdGg6IGJ1aWxkT3V0cHV0LmF0UGF0aChgJHtzZXJ2aWNlU3RhY2suc3RhY2tOYW1lfS5kZXBsb3llZC50ZW1wbGF0ZS5qc29uYCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGVtcGxhdGVDb25maWd1cmF0aW9uOiBidWlsZE91dHB1dC5hdFBhdGgoYHRlbXBsYXRlLmNvbmZpZy5qc29uYCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhY2tOYW1lOiBzZXJ2aWNlU3RhY2suc3RhY2tOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkbWluUGVybWlzc2lvbnM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGFydGlmYWN0QnVja2V0OiBhcnRpZmFjdEJ1Y2tldCxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChjb2Rlc3RhckNvbm5lY3Rpb25Bcm5Ub1VzZSkge1xuICAgICAgICAgICAgcGlwZWxpbmUuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgICAgYWN0aW9uczogWydjb2Rlc3Rhci1jb25uZWN0aW9uczpVc2VDb25uZWN0aW9uJ10sXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbY29kZXN0YXJDb25uZWN0aW9uQXJuVG9Vc2VdLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZW5zdXJlVGFncyh0aGlzLCB0YWdzKVxuICAgICAgICBlbnN1cmVUYWdzKHByb3BzLnNlcnZpY2VTdGFjaywgdGFncylcbiAgICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tbWFuZCB7XG4gICAgcnVudGltZVZlcnNpb246IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG4gICAgaW5zdGFsbD86IHN0cmluZztcbiAgICBidWlsZD86IHN0cmluZztcbiAgICBjb3Zlcj86IHN0cmluZztcbn1cblxuZnVuY3Rpb24gY29tbWFuZHNGb3IobGFuZ3VhZ2VzOiBzdHJpbmdbXSk6IENvbW1hbmRbXSB7XG4gICAgcmV0dXJuIGxhbmd1YWdlcy5tYXAobGFuZ3VhZ2UgPT4ge1xuICAgICAgICByZXR1cm4gY29tbWFuZEZvcihsYW5ndWFnZSk7XG4gICAgfSlcbn1cblxuZnVuY3Rpb24gY29tbWFuZEZvcihsYW5ndWFnZTogc3RyaW5nKTogQ29tbWFuZCB7XG4gICAgc3dpdGNoIChsYW5ndWFnZSkge1xuICAgICAgICBjYXNlICdnb2xhbmcnOlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBydW50aW1lVmVyc2lvbjoge2dvbGFuZzogJzEuMTUnfSxcbiAgICAgICAgICAgICAgICBpbnN0YWxsOiAnZ28gZ2V0IGdpdGh1Yi5jb20vYXh3L2dvY292L2dvY292IGdpdGh1Yi5jb20vQWxla1NpL2dvY292LXhtbCcsXG4gICAgICAgICAgICAgICAgYnVpbGQ6ICcuL29wcy9ub2RlX21vZHVsZXMvLmJpbi9idWlsZC1nby1mdW5jdGlvbnMuc2ggJyxcbiAgICAgICAgICAgICAgICBjb3ZlcjogJ3JtIC1SZiAuL29wcy9ub2RlX21vZHVsZXMvYXdzLWNkay9saWIvaW5pdC10ZW1wbGF0ZXMvdiogJiYgR09fVEVTVD10cnVlIGdvIHRlc3QgLi8uLi4gLWNvdmVycHJvZmlsZT1jb3Zlci5vdXQgLWNvdmVycGtnPS4vLi4uICYmIC90bXAvZ28vYmluL2dvY292IGNvbnZlcnQgY292ZXIub3V0IHwgL3RtcC9nby9iaW4vZ29jb3YteG1sID4gY292ZXJhZ2UueG1sJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgY2FzZSAnbm9kZWpzJzpcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcnVudGltZVZlcnNpb246IHtub2RlanM6ICcxNCd9LFxuICAgICAgICAgICAgICAgIGluc3RhbGw6ICcuL29wcy9ub2RlX21vZHVsZXMvLmJpbi9pbnN0YWxsLW5vZGUtZGVwZW5kZW5jaWVzLnNoICYmIC4vb3BzL25vZGVfbW9kdWxlcy8uYmluL2xpbmstdHlwZXNjcmlwdC1sYXllcnMuc2gnLFxuICAgICAgICAgICAgICAgIGJ1aWxkOiAnbnBtIHJ1biBidWlsZCAmJiBucG0gcnVuIHRlc3QgJiYgLi9vcHMvbm9kZV9tb2R1bGVzLy5iaW4vcHJ1bmUtbm9kZS1ub24tcHJvZC1kZXBlbmRlbmNpZXMuc2gnLFxuICAgICAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcnVudGltZVZlcnNpb246IHt9LFxuICAgIH1cbn1cblxuZnVuY3Rpb24gcnVudGltZVZlcnNpb25zKGNvbW1hbmRzOiBDb21tYW5kW10pOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9IHtcbiAgICBsZXQgdmFsdWUgPSB7fTtcbiAgICBjb21tYW5kcy5mb3JFYWNoKGNvbW1hbmQgPT4ge1xuICAgICAgICBPYmplY3QuYXNzaWduKHZhbHVlLCBjb21tYW5kLnJ1bnRpbWVWZXJzaW9uKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdmFsdWVcbn1cblxuZnVuY3Rpb24gYnVpbGRDb21tYW5kcyhjb21tYW5kczogQ29tbWFuZFtdKTogc3RyaW5nW10ge1xuICAgIGxldCB2YWx1ZTogc3RyaW5nW10gPSBbXTtcbiAgICBjb21tYW5kcy5mb3JFYWNoKChjb21tYW5kOiBDb21tYW5kKSA9PiB7XG4gICAgICAgIGlmIChjb21tYW5kLmJ1aWxkKSB7XG4gICAgICAgICAgICB2YWx1ZS5wdXNoKGNvbW1hbmQuYnVpbGQpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHZhbHVlXG59XG5cbmZ1bmN0aW9uIGNvZGVDb3ZlcmFnZUNvbW1hbmRzKGNvbW1hbmRzOiBDb21tYW5kW10pOiBzdHJpbmdbXSB7XG4gICAgbGV0IHZhbHVlOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbW1hbmRzLmZvckVhY2goKGNvbW1hbmQ6IENvbW1hbmQpID0+IHtcbiAgICAgICAgaWYgKGNvbW1hbmQuY292ZXIpIHtcbiAgICAgICAgICAgIHZhbHVlLnB1c2goY29tbWFuZC5jb3Zlcik7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdmFsdWVcbn1cblxuZnVuY3Rpb24gaW5zdGFsbENvbW1hbmRzKGNvbW1hbmRzOiBDb21tYW5kW10pOiBzdHJpbmdbXSB7XG4gICAgbGV0IHZhbHVlOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbW1hbmRzLmZvckVhY2goKGNvbW1hbmQ6IENvbW1hbmQpID0+IHtcbiAgICAgICAgaWYgKGNvbW1hbmQuaW5zdGFsbCkge1xuICAgICAgICAgICAgdmFsdWUucHVzaChjb21tYW5kLmluc3RhbGwpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHZhbHVlXG59XG5cbmZ1bmN0aW9uIHRlbXBsYXRlQ29uZmlndXJhdGlvbkZvcih0YWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTogeyBUYWdzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH0ge1xuICAgIHJldHVybiB7XG4gICAgICAgIFRhZ3M6IHRhZ3MsXG4gICAgfVxufVxuXG5mdW5jdGlvbiBlbmNvZGVTaW5nbGVRdW90ZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKFwiJ1wiLCBcIidcXCcnXCIpXG59XG5cbmZ1bmN0aW9uIGVuc3VyZVRhZ3Moc2NvcGU6IENvbnN0cnVjdCwgdGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nPikge1xuICAgIGZvciAoY29uc3Qga2V5IGluIHRhZ3MpIHtcbiAgICAgICAgVGFncy5vZihzY29wZSkuYWRkKGtleSwgdGFnc1trZXldKVxuICAgIH1cbn1cbiJdfQ==