type AppAPI = {
    onRefresh?: () => void;
    onConfigure?: () => void;
}

import type AlertService from "@jetbrains/ring-ui-built/components/alert-service/alert-service";
import type {RequestParams} from "@jetbrains/ring-ui-built/components/http/http";

export interface HubService {
    id: string;
    applicationName: string;
    homeUrl: string;
}

interface BaseAPILayer {
    alert: (message: string, type?: AlertType, timeout?: number) => void;
    enterModalMode: () => Promise<void>;
    exitModalMode: () => Promise<void>;
    collapse: () => Promise<void>;
    closeWidget: () => Promise<void>;
    reportWidgetSize: ({height, width}?: { height: number, width: number }) => Promise<void>;
}

/*
 * This layer should allow plugin to call YT endpoints while being sure there is just ONE YouTrack instance
 */
export interface InstanceAwareAPILayer extends BaseAPILayer {
    fetchYouTrack: <T = unknown>(relativeURL: string, requestParams?: RequestParams) => Promise<T>;
}

/*
 * This layer allows plugin to communicate with own backend
 */
export interface PluginEndpointAPILayer extends InstanceAwareAPILayer {
    fetchApp: <T = unknown>(relativeURL: string, requestParams?: RequestParams & { scope?: boolean }) => Promise<T>;
}

/*
 * This layer is only available for MARKDOWN and DASHBOARD_WIDGET extension points
 */
export interface EmbeddableWidgetAPI extends PluginEndpointAPILayer {
    setTitle: (label: string, labelUrl: string) => Promise<void>;
    setLoadingAnimationEnabled: (isEnabled: boolean) => Promise<void>;

    enterConfigMode: () => Promise<void>;
    exitConfigMode: () => Promise<void>;

    setError: (e: Error) => Promise<void>;
    clearError: () => Promise<void>;

    readCache: <T = unknown>() => Promise<T | null>;
    storeCache: (data: unknown) => Promise<void>;

    readConfig: <T = unknown>() => Promise<T | null>;
    storeConfig: (config: unknown) => Promise<void>;

    downloadFile: (serviceID: string, relativeURL: string, requestParams: unknown, fileName?: string) => Promise<void>;
    fetchHub: (relativeURL: string, requestParams: RequestParams) => Promise<unknown>;

    loadServices: (applicationName: string) => Promise<HubService[]>;

    alert: (...args: Parameters<(typeof AlertService)["addAlert"]>) => Promise<void>;
    removeWidget: () => void;
}

export type HostAPI = PluginEndpointAPILayer;


type YTAppInterface = {
    locale: string;
    entity?: {
        id: string;
        type: "user" | "article" | "ticket" | "project" | "app"
    };
    register: (appApi?: AppAPI) => Promise<HostAPI | EmbeddableWidgetAPI>;
    me: {
        avatarUrl: string,
        id: string,
        login: string,
        name: string,
    }
}

declare global {
    const YTApp: YTAppInterface;
}


export interface HttpHandler {
    endpoints: Array<Endpoint>;
}

export type Scope = "issue" | "project" | "article" | "user" | "global";
export type Method = "GET" | "POST" | "PUT" | "DELETE";

export type EndpointForScope<scope extends Scope> =
    scope extends "issue" ? { scope: "issue"; handle: (ctx: Context<"issue">) => void; } :
        scope extends "project" ? { scope: "project"; handle: (ctx: Context<"project">) => void; } :
            scope extends "article" ? { scope: "article"; handle: (ctx: Context<"article">) => void; } :
                scope extends "user" ? { scope: "user"; handle: (ctx: Context<"user">) => void; } :
                    { scope?: undefined, handle: (ctx: Context<"global">) => void }

export type Endpoint<scope extends Scope = Scope> = {
    method: Method;
    path: string;
    permissions?: string[];
} & EndpointForScope<scope>

export type ContextForScope<scope extends Scope> =
    scope extends "issue" ? { issue: any } :
        scope extends "project" ? { project: any } :
            scope extends "article" ? { article: any } :
                scope extends "user" ? { user: any } : {};

export type Context<scope extends Scope> = {
    request: Request
    response: Response
    // Array and object can only represent YouTrack core entities
    settings: Record<string, string | number | boolean | Array | object | null>
    globalStorage: {
        // object can only represent YouTrack core entities
        extensionProperties: Record<string, string | number | boolean | object | null>
    }
} & ContextForScope<scope>

export type Request = {
    body: string;
    bodyAsStream: ReadableStream<Uint8Array>;
    headers: Array<{ name: string, value: string }>;
    path: string;
    fullPath: string;
    method: Method;
    parameterNames: Array<string>;
    json(): any;
    getParameter(name: string): string | undefined;
    getParameter(name: string): Array<string>;
}

export type Response = {
    body: string;
    bodyAsStream: ReadableStream<Uint8Array>;
    code: number;
    json(object: any): void;
    text(string: string): string;
    addHeader(header: string, value: string): Response;
}

export interface APIError {
    data: {
        error: string,
        error_description: string
    },
    message: string,
    status: number
}

export interface ArticleBase {
    readonly id: string,
    readonly idReadable: string,
    summary: string | null,
}

export interface Article extends ArticleBase {
    readonly attachments: Array<Pick<Attachment, "id">>,
    readonly childArticles: Array<Pick<Article, "id">>,
    readonly comments: Array<{ readonly id: string }>,
    content: string | null,
    readonly hasChildren: boolean,
    parentArticle: ArticleBase | null,
    project: Project,
    reporter: { readonly id: string } | null,
    tags: { readonly id: string }[],
    visibility: { readonly id: string } | null,
}

export interface Project {
    readonly id: string,
    readonly name: string,
    articles?: Array<ArticleBase>,
}

export interface Attachment {
    readonly id: string,
    name: string | null,
    base64Content: string | null,
}