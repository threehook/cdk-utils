export enum ParameterType {
    QueryString = 'querystring',
    MultiValueQueryString = 'multivaluequerystring',
    Path = 'path',
    Header = 'header',
    AuthorizerContextToHeader = 'context-to-header',
}

export interface ProxyParameter {
    readonly type: ParameterType;
    readonly name: string;
    readonly required: boolean;
}

export function q(name: string): ProxyParameter {
    return {
        type: ParameterType.QueryString,
        name,
        required: true,
    }
}

export function multiQ(name: string): ProxyParameter {
    return {
        type: ParameterType.MultiValueQueryString,
        name,
        required: true,
    }
}

export function principalId(): ProxyParameter {
    return {
        type: ParameterType.AuthorizerContextToHeader,
        name: 'principalId',
        required: true
    }
}

export function username(): ProxyParameter {
    return {
        type: ParameterType.AuthorizerContextToHeader,
        name: 'username',
        required: true
    }
}

export function permissions(): ProxyParameter {
    return {
        type: ParameterType.AuthorizerContextToHeader,
        name: 'permissions',
        required: false
    }
}

export function delivererId(): ProxyParameter {
    return {
        type: ParameterType.AuthorizerContextToHeader,
        name: 'delivererId',
        required: false
    }
}

export function optional(param: ProxyParameter): ProxyParameter {
    return {
        type: param.type,
        name: param.name,
        required: false,
    }
}

export function unique(value: ProxyParameter[]): ProxyParameter[] {
    return [...new Set(value)];
}

export function parametersFromPath(path: string): ProxyParameter[] {
    return path
        .split("/")
        .filter((part: string) => {
            return (part.startsWith('{') && part.endsWith('}'))
        })
        .map((part: string) => {
            return {
                type: ParameterType.Path,
                name: part.substring(1, part.length - 1),
                required: true,
            }
        })
}

export function backendRequestParamsFor(params: ProxyParameter[]): { [name: string]: string } {
    const requestParams: { [name: string]: string } = {};
    params.filter(param => param.type != ParameterType.AuthorizerContextToHeader)
        .forEach((param: ProxyParameter) => {
            requestParams[integrationRequestParamNameFor(param)] = methodRequestParamNameFor(param);
        })
    return requestParams;
}

export function acceptRequestParamsFor(params: ProxyParameter[]): { [name: string]: boolean } {
    let value: { [name: string]: boolean } = {}
    params.filter(param => param.type != ParameterType.AuthorizerContextToHeader)
        .forEach((param) => {
            value[methodRequestParamNameFor(param, ParameterType.QueryString)] = param.required;
        })
    return value;
}

// Hack to be able to set the headers from the context authorizer values.
// This is not possible via the request parameters.
export function requestTemplatesFor(params: ProxyParameter[]): { [dest: string]: string } | undefined {
    const authParams = params.filter(param => param.type == ParameterType.AuthorizerContextToHeader);
    if (authParams.length == 0) {
        return undefined;
    }
    return {
        "application/json": `$input.json("$")\n` + authParams
            .map(param => `#set($context.requestOverride.header.authorizer-${param.name} = $context.authorizer.${param.name})`)
            .join("\n")
    };
}


function integrationRequestParamNameFor(param: ProxyParameter): string {
    if (param.type == ParameterType.MultiValueQueryString) {
        return `integration.request.${ParameterType.QueryString}.${param.name}`
    }
    return `integration.request.${param.type}.${param.name}`
}

function methodRequestParamNameFor(param: ProxyParameter, mapMultiTo?: ParameterType): string {
    if (mapMultiTo && param.type == ParameterType.MultiValueQueryString) {
        return `method.request.${mapMultiTo}.${param.name}`;
    }
    return `method.request.${param.type}.${param.name}`;
}
