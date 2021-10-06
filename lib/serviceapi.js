"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceApi = void 0;
const cdk = require("@aws-cdk/core");
const apigateway = require("@aws-cdk/aws-apigateway");
const aws_certificatemanager_1 = require("@aws-cdk/aws-certificatemanager");
const route53 = require("@aws-cdk/aws-route53");
const targets = require("@aws-cdk/aws-route53-targets/lib");
const api_keys_1 = require("./api_keys");
const proxyparameter_1 = require("./proxyparameter");
class ServiceApi extends cdk.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        this.api = new apigateway.RestApi(this, "Api", this.apiProps(props));
        api_keys_1.addApiKeysToApi(this.api, props.apiKeys);
        aRecordFor(this, props.url, this.api);
    }
    apiProps(props) {
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
                certificate: aws_certificatemanager_1.Certificate.fromCertificateArn(this, 'Certificate', props.url.certificateArn),
            },
        };
    }
    get root() {
        return this.api.root;
    }
    withFunctionOn(path, method, fct) {
        this.root.resourceForPath(path).addMethod(method, new apigateway.LambdaIntegration(fct));
    }
    withS3ProxyOn(path, method, bucket, objectKey, credentialsRole) {
        const params = proxyparameter_1.parametersFromPath(path);
        this.root.resourceForPath(path).addMethod(method, new apigateway.AwsIntegration({
            service: "s3",
            integrationHttpMethod: method,
            path: `${bucket.bucketName}${objectKey}`,
            options: {
                credentialsRole,
                requestParameters: proxyparameter_1.backendRequestParamsFor(params),
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
            requestParameters: proxyparameter_1.acceptRequestParamsFor(params),
        });
    }
}
exports.ServiceApi = ServiceApi;
function aRecordFor(scope, url, api) {
    return new route53.ARecord(scope, 'ApiAliasRecord', {
        recordName: fullSubdomainName(url),
        target: route53.RecordTarget.fromAlias(new targets.ApiGateway(api)),
        zone: route53.HostedZone.fromLookup(scope, 'Zone', { domainName: url.domain }),
    });
}
function fullSubdomainName(url) {
    if (url.subdomain === '') {
        return url.domain;
    }
    return url.subdomain + '.' + url.domain;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZWFwaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcnZpY2VhcGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBQ3JDLHNEQUFzRDtBQUN0RCw0RUFBOEQ7QUFFOUQsZ0RBQWdEO0FBRWhELDREQUE0RDtBQUU1RCx5Q0FBMEQ7QUFDMUQscURBQXVHO0FBZ0J2RyxNQUFhLFVBQVcsU0FBUSxHQUFHLENBQUMsU0FBUztJQXlCekMsWUFBWSxLQUFvQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBRXJFLDBCQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUE7UUFFeEMsVUFBVSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBOUJELFFBQVEsQ0FBQyxLQUFzQjtRQUMzQixPQUFPO1lBQ0gsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQixDQUFDLE1BQU07WUFDcEQsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGdCQUFnQjtZQUN4QyxhQUFhLEVBQUU7Z0JBQ1gsY0FBYyxFQUFFLElBQUk7Z0JBQ3BCLFNBQVMsRUFBRSxLQUFLLENBQUMsS0FBSzthQUN6QjtZQUNELG9CQUFvQixFQUFFO2dCQUNsQixjQUFjLEVBQUUsSUFBSTthQUN2QjtZQUNELHFCQUFxQixFQUFFO2dCQUNuQixLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQzthQUM1QztZQUNELFdBQVcsRUFBRSxLQUFLLENBQUMsSUFBSTtZQUN2QixVQUFVLEVBQUU7Z0JBQ1IsVUFBVSxFQUFFLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUM7Z0JBQ3hDLFdBQVcsRUFBRSxvQ0FBVyxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUM7YUFDN0Y7U0FDSixDQUFDO0lBQ04sQ0FBQztJQVlELElBQUksSUFBSTtRQUNKLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7SUFDekIsQ0FBQztJQUVELGNBQWMsQ0FBQyxJQUFZLEVBQUUsTUFBYyxFQUFFLEdBQW9CO1FBQzdELElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM3RixDQUFDO0lBRUQsYUFBYSxDQUFDLElBQVksRUFBRSxNQUFjLEVBQUUsTUFBa0IsRUFBRSxTQUFpQixFQUFFLGVBQXlCO1FBQ3hHLE1BQU0sTUFBTSxHQUFHLG1DQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsY0FBYyxDQUFDO1lBQzVFLE9BQU8sRUFBRSxJQUFJO1lBQ2IscUJBQXFCLEVBQUUsTUFBTTtZQUM3QixJQUFJLEVBQUUsR0FBRyxNQUFNLENBQUMsVUFBVSxHQUFHLFNBQVMsRUFBRTtZQUN4QyxPQUFPLEVBQUU7Z0JBQ0wsZUFBZTtnQkFDZixpQkFBaUIsRUFBRSx3Q0FBdUIsQ0FBQyxNQUFNLENBQUM7Z0JBQ2xELG1CQUFtQixFQUFFLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxpQkFBaUI7Z0JBQ3JFLG9CQUFvQixFQUFFO29CQUNsQjt3QkFDSSxVQUFVLEVBQUUsS0FBSzt3QkFDakIsZ0JBQWdCLEVBQUUsS0FBSzt3QkFDdkIsa0JBQWtCLEVBQUU7NEJBQ2hCLHFDQUFxQyxFQUFFLDBDQUEwQzs0QkFDakYsdUNBQXVDLEVBQUUsNENBQTRDO3lCQUN4RjtxQkFDSjtvQkFDRDt3QkFDSSxVQUFVLEVBQUUsS0FBSzt3QkFDakIsZ0JBQWdCLEVBQUUsS0FBSzt3QkFDdkIsa0JBQWtCLEVBQUU7NEJBQ2hCLHFDQUFxQyxFQUFFLDBDQUEwQzt5QkFDcEY7cUJBQ0o7b0JBQ0Q7d0JBQ0ksVUFBVSxFQUFFLEtBQUs7d0JBQ2pCLGdCQUFnQixFQUFFLEtBQUs7d0JBQ3ZCLGtCQUFrQixFQUFFOzRCQUNoQixxQ0FBcUMsRUFBRSwwQ0FBMEM7eUJBQ3BGO3FCQUNKO29CQUNEO3dCQUNJLFVBQVUsRUFBRSxLQUFLO3dCQUNqQixnQkFBZ0IsRUFBRSxLQUFLO3dCQUN2QixrQkFBa0IsRUFBRTs0QkFDaEIscUNBQXFDLEVBQUUsMENBQTBDO3lCQUNwRjtxQkFDSjtvQkFDRDt3QkFDSSxVQUFVLEVBQUUsS0FBSzt3QkFDakIsZ0JBQWdCLEVBQUUsS0FBSzt3QkFDdkIsa0JBQWtCLEVBQUU7NEJBQ2hCLHFDQUFxQyxFQUFFLDBDQUEwQzt5QkFDcEY7cUJBQ0o7aUJBQ0o7YUFDSjtTQUNKLENBQUMsRUFBRTtZQUNBLGVBQWUsRUFBRTtnQkFDYjtvQkFDSSxVQUFVLEVBQUUsS0FBSztvQkFDakIsa0JBQWtCLEVBQUU7d0JBQ2hCLHFDQUFxQyxFQUFFLElBQUk7d0JBQzNDLHVDQUF1QyxFQUFFLElBQUk7cUJBQ2hEO2lCQUNKO2dCQUNEO29CQUNJLFVBQVUsRUFBRSxLQUFLO29CQUNqQixrQkFBa0IsRUFBRTt3QkFDaEIscUNBQXFDLEVBQUUsSUFBSTtxQkFDOUM7aUJBQ0o7Z0JBQ0Q7b0JBQ0ksVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLGtCQUFrQixFQUFFO3dCQUNoQixxQ0FBcUMsRUFBRSxJQUFJO3FCQUM5QztpQkFDSjtnQkFDRDtvQkFDSSxVQUFVLEVBQUUsS0FBSztvQkFDakIsa0JBQWtCLEVBQUU7d0JBQ2hCLHFDQUFxQyxFQUFFLElBQUk7cUJBQzlDO2lCQUNKO2FBQ0o7WUFDRCxpQkFBaUIsRUFBRSx1Q0FBc0IsQ0FBQyxNQUFNLENBQUM7U0FDcEQsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztDQUdKO0FBN0hELGdDQTZIQztBQUVELFNBQVMsVUFBVSxDQUFDLEtBQW9CLEVBQUUsR0FBZSxFQUFFLEdBQXVCO0lBQzlFLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxnQkFBZ0IsRUFBRTtRQUNoRCxVQUFVLEVBQUUsaUJBQWlCLENBQUMsR0FBRyxDQUFDO1FBQ2xDLE1BQU0sRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbkUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxVQUFVLEVBQUUsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO0tBQ2pGLENBQUMsQ0FBQztBQUNQLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLEdBQWU7SUFDdEMsSUFBSSxHQUFHLENBQUMsU0FBUyxLQUFLLEVBQUUsRUFBRTtRQUN0QixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUM7S0FDckI7SUFDRCxPQUFPLEdBQUcsQ0FBQyxTQUFTLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDNUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0IHsgQ2VydGlmaWNhdGUgfSBmcm9tICdAYXdzLWNkay9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiQGF3cy1jZGsvYXdzLWlhbVwiXG5pbXBvcnQgKiBhcyByb3V0ZTUzIGZyb20gJ0Bhd3MtY2RrL2F3cy1yb3V0ZTUzJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ0Bhd3MtY2RrL2F3cy1zMydcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnQGF3cy1jZGsvYXdzLXJvdXRlNTMtdGFyZ2V0cy9saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgYWRkQXBpS2V5c1RvQXBpLCBBcGlLZXlEZXNjciB9IGZyb20gJy4vYXBpX2tleXMnO1xuaW1wb3J0IHsgYmFja2VuZFJlcXVlc3RQYXJhbXNGb3IsIGFjY2VwdFJlcXVlc3RQYXJhbXNGb3IsIHBhcmFtZXRlcnNGcm9tUGF0aCB9IGZyb20gJy4vcHJveHlwYXJhbWV0ZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlcnZpY2VBcGlQcm9wcyB7XG4gICAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICAgIHJlYWRvbmx5IHN0YWdlOiBzdHJpbmc7XG4gICAgcmVhZG9ubHkgYXBpS2V5czogQXBpS2V5RGVzY3JbXTtcbiAgICByZWFkb25seSB1cmw6IFNlcnZpY2VVcmw7XG4gICAgcmVhZG9ubHkgYmluYXJ5TWVkaWFUeXBlcz86IHN0cmluZ1tdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNlcnZpY2VVcmwge1xuICAgIHJlYWRvbmx5IGRvbWFpbjogc3RyaW5nO1xuICAgIHJlYWRvbmx5IHN1YmRvbWFpbjogc3RyaW5nO1xuICAgIHJlYWRvbmx5IGNlcnRpZmljYXRlQXJuOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTZXJ2aWNlQXBpIGV4dGVuZHMgY2RrLkNvbnN0cnVjdCB7XG4gICAgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG5cbiAgICBhcGlQcm9wcyhwcm9wczogU2VydmljZUFwaVByb3BzKTogYXBpZ2F0ZXdheS5SZXN0QXBpUHJvcHMge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXBpS2V5U291cmNlVHlwZTogYXBpZ2F0ZXdheS5BcGlLZXlTb3VyY2VUeXBlLkhFQURFUixcbiAgICAgICAgICAgIGJpbmFyeU1lZGlhVHlwZXM6IHByb3BzLmJpbmFyeU1lZGlhVHlwZXMsXG4gICAgICAgICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgdHJhY2luZ0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgc3RhZ2VOYW1lOiBwcm9wcy5zdGFnZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWZhdWx0TWV0aG9kT3B0aW9uczoge1xuICAgICAgICAgICAgICAgIGFwaUtleVJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVuZHBvaW50Q29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGVzOiBbYXBpZ2F0ZXdheS5FbmRwb2ludFR5cGUuUkVHSU9OQUxdXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzdEFwaU5hbWU6IHByb3BzLm5hbWUsXG4gICAgICAgICAgICBkb21haW5OYW1lOiB7XG4gICAgICAgICAgICAgICAgZG9tYWluTmFtZTogZnVsbFN1YmRvbWFpbk5hbWUocHJvcHMudXJsKSxcbiAgICAgICAgICAgICAgICBjZXJ0aWZpY2F0ZTogQ2VydGlmaWNhdGUuZnJvbUNlcnRpZmljYXRlQXJuKHRoaXMsICdDZXJ0aWZpY2F0ZScsIHByb3BzLnVybC5jZXJ0aWZpY2F0ZUFybiksXG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU2VydmljZUFwaVByb3BzKSB7XG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAgICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsIFwiQXBpXCIsIHRoaXMuYXBpUHJvcHMocHJvcHMpKTtcblxuICAgICAgICBhZGRBcGlLZXlzVG9BcGkodGhpcy5hcGksIHByb3BzLmFwaUtleXMpXG5cbiAgICAgICAgYVJlY29yZEZvcih0aGlzLCBwcm9wcy51cmwsIHRoaXMuYXBpKTtcbiAgICB9XG5cbiAgICBnZXQgcm9vdCgpOiBhcGlnYXRld2F5LklSZXNvdXJjZSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFwaS5yb290O1xuICAgIH1cblxuICAgIHdpdGhGdW5jdGlvbk9uKHBhdGg6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIGZjdDogbGFtYmRhLkZ1bmN0aW9uKTogdm9pZCB7XG4gICAgICAgIHRoaXMucm9vdC5yZXNvdXJjZUZvclBhdGgocGF0aCkuYWRkTWV0aG9kKG1ldGhvZCwgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZmN0KSk7XG4gICAgfVxuXG4gICAgd2l0aFMzUHJveHlPbihwYXRoOiBzdHJpbmcsIG1ldGhvZDogc3RyaW5nLCBidWNrZXQ6IHMzLklCdWNrZXQsIG9iamVjdEtleTogc3RyaW5nLCBjcmVkZW50aWFsc1JvbGU6IGlhbS5Sb2xlKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHBhcmFtZXRlcnNGcm9tUGF0aChwYXRoKTtcbiAgICAgICAgdGhpcy5yb290LnJlc291cmNlRm9yUGF0aChwYXRoKS5hZGRNZXRob2QobWV0aG9kLCBuZXcgYXBpZ2F0ZXdheS5Bd3NJbnRlZ3JhdGlvbih7XG4gICAgICAgICAgICBzZXJ2aWNlOiBcInMzXCIsXG4gICAgICAgICAgICBpbnRlZ3JhdGlvbkh0dHBNZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgIHBhdGg6IGAke2J1Y2tldC5idWNrZXROYW1lfSR7b2JqZWN0S2V5fWAsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgY3JlZGVudGlhbHNSb2xlLFxuICAgICAgICAgICAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiBiYWNrZW5kUmVxdWVzdFBhcmFtc0ZvcihwYXJhbXMpLFxuICAgICAgICAgICAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IGFwaWdhdGV3YXkuUGFzc3Rocm91Z2hCZWhhdmlvci5XSEVOX05PX1RFTVBMQVRFUyxcbiAgICAgICAgICAgICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGlvblBhdHRlcm46ICcyMDAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJtZXRob2QucmVzcG9uc2UuaGVhZGVyLkNvbnRlbnQtVHlwZVwiOiBcImludGVncmF0aW9uLnJlc3BvbnNlLmhlYWRlci5Db250ZW50LVR5cGVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ29udGVudC1MZW5ndGhcIjogXCJpbnRlZ3JhdGlvbi5yZXNwb25zZS5oZWFkZXIuQ29udGVudC1MZW5ndGhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzQwMCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3Rpb25QYXR0ZXJuOiAnMz8/JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5Db250ZW50LVR5cGVcIjogXCJpbnRlZ3JhdGlvbi5yZXNwb25zZS5oZWFkZXIuQ29udGVudC1UeXBlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6ICc0MDQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0aW9uUGF0dGVybjogJzQwNCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ29udGVudC1UeXBlXCI6IFwiaW50ZWdyYXRpb24ucmVzcG9uc2UuaGVhZGVyLkNvbnRlbnQtVHlwZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAnNDAwJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGlvblBhdHRlcm46ICc0Pz8nLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJtZXRob2QucmVzcG9uc2UuaGVhZGVyLkNvbnRlbnQtVHlwZVwiOiBcImludGVncmF0aW9uLnJlc3BvbnNlLmhlYWRlci5Db250ZW50LVR5cGVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogJzUwMCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3Rpb25QYXR0ZXJuOiAnNT8/JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5Db250ZW50LVR5cGVcIjogXCJpbnRlZ3JhdGlvbi5yZXNwb25zZS5oZWFkZXIuQ29udGVudC1UeXBlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICB9KSwge1xuICAgICAgICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiBcIjIwMFwiLFxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5Db250ZW50LVR5cGVcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5Db250ZW50LUxlbmd0aFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiBcIjQwMFwiLFxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibWV0aG9kLnJlc3BvbnNlLmhlYWRlci5Db250ZW50LVR5cGVcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogXCI0MDRcIixcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcIm1ldGhvZC5yZXNwb25zZS5oZWFkZXIuQ29udGVudC1UeXBlXCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IFwiNTAwXCIsXG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJtZXRob2QucmVzcG9uc2UuaGVhZGVyLkNvbnRlbnQtVHlwZVwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IGFjY2VwdFJlcXVlc3RQYXJhbXNGb3IocGFyYW1zKSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbn1cblxuZnVuY3Rpb24gYVJlY29yZEZvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgdXJsOiBTZXJ2aWNlVXJsLCBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaSk6IHJvdXRlNTMuQVJlY29yZCB7XG4gICAgcmV0dXJuIG5ldyByb3V0ZTUzLkFSZWNvcmQoc2NvcGUsICdBcGlBbGlhc1JlY29yZCcsIHtcbiAgICAgICAgcmVjb3JkTmFtZTogZnVsbFN1YmRvbWFpbk5hbWUodXJsKSxcbiAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMobmV3IHRhcmdldHMuQXBpR2F0ZXdheShhcGkpKSxcbiAgICAgICAgem9uZTogcm91dGU1My5Ib3N0ZWRab25lLmZyb21Mb29rdXAoc2NvcGUsICdab25lJywgeyBkb21haW5OYW1lOiB1cmwuZG9tYWluIH0pLFxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBmdWxsU3ViZG9tYWluTmFtZSh1cmw6IFNlcnZpY2VVcmwpOiBzdHJpbmcge1xuICAgIGlmICh1cmwuc3ViZG9tYWluID09PSAnJykge1xuICAgICAgICByZXR1cm4gdXJsLmRvbWFpbjtcbiAgICB9XG4gICAgcmV0dXJuIHVybC5zdWJkb21haW4gKyAnLicgKyB1cmwuZG9tYWluO1xufVxuIl19