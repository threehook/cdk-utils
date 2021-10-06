export declare enum ParameterType {
    QueryString = "querystring",
    MultiValueQueryString = "multivaluequerystring",
    Path = "path",
    Header = "header",
    AuthorizerContextToHeader = "context-to-header"
}
export interface ProxyParameter {
    readonly type: ParameterType;
    readonly name: string;
    readonly required: boolean;
}
export declare function q(name: string): ProxyParameter;
export declare function multiQ(name: string): ProxyParameter;
export declare function principalId(): ProxyParameter;
export declare function username(): ProxyParameter;
export declare function permissions(): ProxyParameter;
export declare function delivererId(): ProxyParameter;
export declare function optional(param: ProxyParameter): ProxyParameter;
export declare function unique(value: ProxyParameter[]): ProxyParameter[];
export declare function parametersFromPath(path: string): ProxyParameter[];
export declare function backendRequestParamsFor(params: ProxyParameter[]): {
    [name: string]: string;
};
export declare function acceptRequestParamsFor(params: ProxyParameter[]): {
    [name: string]: boolean;
};
export declare function requestTemplatesFor(params: ProxyParameter[]): {
    [dest: string]: string;
} | undefined;
