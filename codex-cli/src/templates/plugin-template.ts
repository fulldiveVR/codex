// Exports the plugin template as a string literal

export const PLUGIN_TEMPLATE_STRING = `
// --- BEGIN TEMPLATE ---

// --- Imports ---
// Assumed imports - paths might need adjustment based on actual project structure
import defineAction from "../helpers/define-action";
import defineApp from "../helpers/define-app";
// Other potential common imports (add as needed):
// import type { AxiosRequestConfig } from 'axios';
// import { HttpsProxyAgent } from 'hpagent'; // Example for proxy agent

// --- Global Type Definitions ---
// These types are typically provided by the framework environment.
// Consider moving these to a shared 'types.d.ts' if managing separately.
declare global {
    // --- General JSON Types ---
    type IJSONValue =
        | string
        | number
        | boolean
        | null
        | IJSONObject
        | IJSONArray;
    type IJSONArray = Array<IJSONValue>;
    interface IJSONObject { [x: string]: IJSONValue }

    // --- HTTP Client Types ---
    interface IRequest extends Request { // Assuming 'Request' is from express
        rawBody?: Buffer;
        currentUser?: IUser;
    }
    type TBeforeRequest = { ($: IGlobalVariable, requestConfig: AxiosRequestConfig): AxiosRequestConfig }; // Assuming AxiosRequestConfig is imported
    type IHttpClient = AxiosInstance; // Assuming AxiosInstance is imported
    type IHttpClientParams = {
        $: IGlobalVariable;
        baseURL?: string;
        beforeRequest?: TBeforeRequest[];
    };

    // --- User & Team Types ---
    interface IUser { id: string; fullName: string; email: string; password: string; }
    interface ITeam { id: string; name: string; role: "maintainer" | "member"; members: IUser[]; organization: IOrganization; }
    interface IOrganization { id: string; key: string; name: string; }

    // --- Webhook Types ---
    interface IVerifyWebhookResponse {
        isVerified: boolean;
        response?: { message: string; contentType?: string; }
    }

    // --- Authentication Types ---
    interface IAuth {
        generateAuthUrl?($: IGlobalVariable): Promise<void>;
        verifyCredentials?($: IGlobalVariable): Promise<void>;
        isStillVerified?($: IGlobalVariable): Promise<boolean>;
        refreshToken?($: IGlobalVariable): Promise<void>;
        verifyWebhook?($: IGlobalVariable): Promise<IVerifyWebhookResponse>;
        isConfigured?: boolean;
        isRefreshTokenRequested?: boolean;
        type?: 'manual' | 'cookies' | 'oauth';
        fields?: IField[];
        authenticationSteps?: IAuthenticationStep[];
        reconnectionSteps?: IAuthenticationStep[];
    }

    // --- Connection & Dynamic Data/Fields ---
    interface IConnection { id: string; key: string; }
    interface IDynamicData { [index: string]: any; } // Consider more specific type if possible
    interface IDynamicFields { key: string; run($: IGlobalVariable): Promise<IField[]>; /* Define return type */ } // Adjusted Function type

    // --- App Definition ---
    type ICategoryType = { name: string }; // Simple example
    interface IApp {
        name: string;
        key: string; // Unique key for the plugin
        categories: ICategoryType[];
        iconUrl: string;
        docUrl?: string;
        authDocUrl: string;
        supportsConnections: boolean;
        apiBaseUrl: string;
        baseUrl: string;
        auth?: IAuth;
        connectionCount?: number;
        flowCount?: number;
        beforeRequest?: TBeforeRequest[];
        dynamicData?: IDynamicData;
        dynamicFields?: IDynamicFields[];
        triggers?: ITrigger[];
        actions?: IAction[];
        description?: string;
    }

    // --- Flow & Execution Types ---
    interface IStep { id: string; appKey?: string; webhookUrl?: string; type: 'action' | 'trigger'; parameters: IJSONObject; webhookType?: 'sync' | 'polling' | 'async'; }
    interface IExecutionStep { id: string; executionId: string; stepId: IStep['id']; step: IStep; dataIn: IJSONObject; dataOut: IJSONObject; errorDetails: IJSONObject; status: string; createdAt: string; updatedAt: string; }
    interface IFlow { id: string; name: string; active: boolean; steps: IStep[]; owner?: { user?: IUser; organization?: IOrganization }; teams?: ITeam[]; }

    // --- Trigger & Action Output Types ---
    interface ITriggerItem { raw: IJSONObject; meta: { internalId: string; }; }
    interface ITriggerOutput { data: ITriggerItem[]; error?: IJSONObject; }
    interface IActionOutput { data: IActionItem; task?: IRawTaskItem; error?: IJSONObject; }
    interface IActionItem { raw: IJSONObject; }
    interface IRawTaskItem { url: string; action: string; context: IJSONObject; }

    // --- Trigger Definition ---
    type ProcessMode = 'normal' | 'approval' | 'wizard' | 'extension';
    interface IBaseTrigger {
        name: string;
        key: string;
        type: 'messaging' | 'webhook' | 'polling' | 'internal';
        mode: ProcessMode;
        showWebhookUrl?: boolean;
        pollInterval?: number;
        pollIntervalOptions?: number[];
        description: string;
        useSingletonWebhook?: boolean;
        singletonWebhookRefValueParameter?: string;
        getRespondingAction?($: IGlobalVariable): Promise<string | undefined>;
        filter?(payload: IJSONObject): boolean;
        getInterval?(parameters: IStep['parameters']): string;
        run?($: IGlobalVariable): Promise<void>;
        testRun?($: IGlobalVariable): Promise<void>;
        registerHook?($: IGlobalVariable): Promise<void>;
        unregisterHook?($: IGlobalVariable): Promise<void>;
    }
    interface IRawTrigger extends IBaseTrigger { // Likely used internally by defineTrigger
        arguments?: IField[];
        compactResponseFields?: ICompactResponseField[];
    }
    interface ITrigger extends IBaseTrigger { // Exported/used in IApp
        substeps?: ISubstep[]; // Assuming ISubstep exists
    }

    // --- Action Definition ---
    interface IBaseAction {
        name: string;
        key: string;
        description: string;
        mode: ProcessMode;
        run?($: IGlobalVariable): Promise<void>;
        errorInterceptor?($: IGlobalVariable, error: Error): Promise<void>;
    }
    interface IRawAction extends IBaseAction { // Likely used internally by defineAction
        arguments?: IField[];
        compactResponseFields?: ICompactResponseField[];
    }
    interface IAction extends IBaseAction { // Exported/used in IApp
        substeps?: ISubstep[]; // Assuming ISubstep exists
    }

    // --- Field Types ---
    interface ICompactResponseField { key: string; keyPath: string; description: string; }
    interface IAuthenticationStepField { name: string; value: string | null; properties?: { name: string; value: string; }[]; }
    interface IAuthenticationStep { type: 'mutation' | 'openWithPopup'; name: string; arguments: IAuthenticationStepField[]; }
    interface IFieldDropdownOption { label: string; value: boolean | string | number | null; }
    interface IFieldDropdownSource { type: string; name: string; arguments: { name: string; value: string; }[]; }
    interface IFieldDropdownAdditionalFields { type: string; name: string; arguments: { name: string; value: string; }[]; }
    interface IFieldDropdown { key: string; label: string; type: 'dropdown'; required: boolean; readOnly?: boolean; value?: string | boolean; placeholder?: string | null; description?: string; docUrl?: string; clickToCopy?: boolean; variables?: boolean; dependsOn?: string[]; options?: IFieldDropdownOption[]; source?: IFieldDropdownSource; additionalFields?: IFieldDropdownAdditionalFields; }
    interface IFieldMultiple { key: string; label: string; type: 'multiple'; required: boolean; readOnly?: boolean; value?: Array<string | boolean | number>; placeholder?: string | null; description?: string; docUrl?: string; clickToCopy?: boolean; variables?: boolean; dependsOn?: string[]; options?: IFieldDropdownOption[]; source?: IFieldDropdownSource; additionalFields?: IFieldDropdownAdditionalFields; }
    interface IFieldText { key: string; label: string; type: 'string'; appearance?: 'text' | 'number' | 'url'; required?: boolean; readOnly?: boolean; value?: string; placeholder?: string | null; description?: string; docUrl?: string; clickToCopy?: boolean; variables?: boolean; dependsOn?: string[]; additionalFields?: IFieldDropdownAdditionalFields; }
    interface IFieldDynamic { key: string; label: string; type: 'dynamic'; required?: boolean; readOnly?: boolean; description?: string; value?: Record<string, unknown>[]; fields: (IFieldDropdown | IFieldText)[]; additionalFields?: IFieldDropdownAdditionalFields; maxValues?: number; }
    type IField = IFieldDropdown | IFieldMultiple | IFieldText | IFieldDynamic;

    // --- Global Variable ($) Type ---
    interface IGlobalVariable {
        auth: {
            set: (args: IJSONObject) => Promise<null>;
            data: IJSONObject;
        };
        app?: IApp;
        http?: IHttpClient;
        rmq?: { // Assuming RabbitMQ or similar
            publish: (exchange: string, routingKey: string, body: IJSONObject) => Promise<boolean>;
        };
        repository?: {
            getFlow(id: string): Promise<IFlow | null>;
            getFlows(): Promise<IFlow[]>;
        };
        datastore: {
            get: (args: { key: string, scope?: 'flow' | 'user' }) => Promise<IJSONObject>;
            set: (args: { key: string; value: string, scope?: 'flow' | 'user' }) => Promise<IJSONObject>;
        };
        filestore: {
            save: (
                source: string | Buffer | Readable, // Assuming Readable is imported from 'stream'
                opts?: { filename?: string, mimeType?: string, folder?: string }
            ) => Promise<{ url: string }>;
        };
        request?: IRequest;
        flow?: {
            id: string;
            name: string;
            lastInternalId: string;
            isAlreadyProcessed?: (internalId: string) => boolean;
            remoteWebhookId?: string;
            setRemoteWebhookId?: (remoteWebhookId: string) => Promise<void>;
        };
        user?: {
            fulldiveShortId: string; // Assuming specific user property
            name: string;
            teams: ITeam[];
        };
        step?: {
            id: string;
            appKey: string;
            parameters: IJSONObject;
            key: string;
        };
        execution?: {
            id: string;
            testRun: boolean;
            abort: (reason?: string) => void;
        };
        getLastExecutionStep?: () => Promise<IExecutionStep>;
        webhookUrl?: string;
        triggerOutput?: ITriggerOutput;
        actionOutput?: IActionOutput;
        scheduledAction?: any; // Define IScheduledActionData if available
        launchFlow?: (flowId: string, payload: IJSONObject) => Promise<IJSONObject>;
        pushTriggerItem?: (triggerItem: ITriggerItem) => void;
        setActionItem?: (actionItem: IActionItem) => void;
        setTaskItem?: (taskItem: IRawTaskItem) => void;
    }
}

// --- Plugin Definition ---

// --- Authentication Definition (Optional) ---
const auth: IAuth | undefined = undefined;
/* Example Auth:
const auth: IAuth = {
    fields: [
        { key: 'apiKey', label: 'API Key', type: 'string' as const, required: true },
    ],
};
*/

// --- Dynamic Fields Definition (Optional) ---
const dynamicFields: IDynamicFields[] | undefined = undefined;
/* Example Dynamic Field:
const exampleDynamicField: IDynamicFields = {
    key: 'exampleOptions',
    async run($: IGlobalVariable) {
        // const someParam = $.step.parameters.someParam;
        return [ { key: 'dynamicField1', label: 'Dynamic Field 1', type: 'string' as const, required: false } ];
    },
};
const dynamicFields = [exampleDynamicField];
*/

// --- Triggers Definition (Optional) ---
const triggers: ITrigger[] | undefined = undefined;
/* Example Trigger:
const exampleTrigger: ITrigger = {
    name: 'Example Trigger',
    key: 'exampleTrigger',
    type: 'webhook', // Example type
    mode: 'normal',
    description: 'Triggers on an example event.',
    // Additional trigger properties...
    async run($: IGlobalVariable) {
        // Logic to handle trigger event and push items
        // $.pushTriggerItem({ raw: { data: 'example' }, meta: { internalId: 'unique-id' } });
    }
};
const triggers = [exampleTrigger];
*/

// --- Actions Definition (Optional) ---
const actions: IAction[] | undefined = undefined;
/* Example Action:
const exampleAction = defineAction({
    name: 'Example Action',
    key: 'exampleAction',
    description: 'Performs an example action.',
    mode: 'normal',
    arguments: [
        { key: 'inputParam', label: 'Input Parameter', type: 'string' as const, required: true, variables: true },
    ],
    async run($: IGlobalVariable) {
        const input = $.step.parameters.inputParam as string;
        const output = \`Processed: \${input}\`;
        $.setActionItem({ raw: { result: output } });
    },
});
const actions = [exampleAction];
*/

// --- Main App Export ---
export default defineApp({
    // --- Required Metadata ---
    name: "My New Plugin", // TODO: Replace
    key: "myNewPlugin", // TODO: Replace
    categories: [ { name: "utility" } ], // TODO: Replace
    iconUrl: "{BASE_ICON_URL}/apps/myNewPlugin/icon.svg", // TODO: Replace
    authDocUrl: "{DOCS_URL}/apps/myNewPlugin/connection", // TODO: Replace
    supportsConnections: false, // TODO: Set based on auth definition
    apiBaseUrl: "", // TODO: Set API base URL or leave empty
    baseUrl: "", // TODO: Set base URL for the service/app

    // --- Optional Metadata ---
    description: "Description of what my new plugin does.", // TODO: Replace
    // docUrl: "{DOCS_URL}/apps/<key>",

    // --- Optional Components ---
    auth: auth,
    dynamicFields: dynamicFields,
    triggers: triggers,
    actions: actions,

    // --- Other Optional Properties ---
    // connectionCount: 0,
    // flowCount: 0,
    // beforeRequest: [],
    // dynamicData: undefined,
});

// --- END TEMPLATE ---
`; // End of template literal string
