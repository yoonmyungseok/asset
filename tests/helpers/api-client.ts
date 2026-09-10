import { NextRequest } from "next/server";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RouteHandler = (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) => Promise<Response>;

type RouteDefinition = {
  pattern: RegExp;
  importPath: string;
  paramNames: string[];
};

const ROUTE_DEFINITIONS: RouteDefinition[] = [
  { pattern: /^\/api\/v1\/health$/, importPath: "@/app/api/v1/health/route", paramNames: [] },
  {
    pattern: /^\/api\/v1\/setup\/initialize$/,
    importPath: "@/app/api/v1/setup/initialize/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/institutions$/,
    importPath: "@/app/api/v1/institutions/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/account-types$/,
    importPath: "@/app/api/v1/account-types/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/accounts$/,
    importPath: "@/app/api/v1/accounts/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/accounts\/(\d+)$/,
    importPath: "@/app/api/v1/accounts/[accountId]/route",
    paramNames: ["accountId"],
  },
  {
    pattern: /^\/api\/v1\/accounts\/(\d+)\/deactivate$/,
    importPath: "@/app/api/v1/accounts/[accountId]/deactivate/route",
    paramNames: ["accountId"],
  },
  {
    pattern: /^\/api\/v1\/ledger-transactions$/,
    importPath: "@/app/api/v1/ledger-transactions/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/ledger-transactions\/summary$/,
    importPath: "@/app/api/v1/ledger-transactions/summary/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/holdings$/,
    importPath: "@/app/api/v1/holdings/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/investment-transactions$/,
    importPath: "@/app/api/v1/investment-transactions/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/investment-transactions\/(\d+)$/,
    importPath: "@/app/api/v1/investment-transactions/[transactionId]/route",
    paramNames: ["transactionId"],
  },
  {
    pattern: /^\/api\/v1\/budgets$/,
    importPath: "@/app/api/v1/budgets/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/budgets\/alerts$/,
    importPath: "@/app/api/v1/budgets/alerts/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/liabilities$/,
    importPath: "@/app/api/v1/liabilities/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/dashboard\/overview$/,
    importPath: "@/app/api/v1/dashboard/overview/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/dashboard\/refresh$/,
    importPath: "@/app/api/v1/dashboard/refresh/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/dashboard\/net-worth-trend$/,
    importPath: "@/app/api/v1/dashboard/net-worth-trend/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/account-limits$/,
    importPath: "@/app/api/v1/account-limits/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/account-limits\/(\d+)$/,
    importPath: "@/app/api/v1/account-limits/[limitId]/route",
    paramNames: ["limitId"],
  },
  {
    pattern: /^\/api\/v1\/recurring-items$/,
    importPath: "@/app/api/v1/recurring-items/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/recurring-items\/generate$/,
    importPath: "@/app/api/v1/recurring-items/generate/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/snapshots\/daily$/,
    importPath: "@/app/api/v1/snapshots/daily/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/backup$/,
    importPath: "@/app/api/v1/backup/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/categories$/,
    importPath: "@/app/api/v1/categories/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/tags$/,
    importPath: "@/app/api/v1/tags/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/cards$/,
    importPath: "@/app/api/v1/cards/route",
    paramNames: [],
  },
  {
    pattern: /^\/api\/v1\/cards\/(\d+)$/,
    importPath: "@/app/api/v1/cards/[cardId]/route",
    paramNames: ["cardId"],
  },
  {
    pattern: /^\/api\/v1\/cards\/process-settlements$/,
    importPath: "@/app/api/v1/cards/process-settlements/route",
    paramNames: [],
  },
];

const routeModuleCache = new Map<string, Record<string, RouteHandler>>();

function splitPathAndQuery(path: string): { pathname: string; search: string } {
  const queryIndex = path.indexOf("?");
  if (queryIndex === -1) {
    return { pathname: path, search: "" };
  }
  return {
    pathname: path.slice(0, queryIndex),
    search: path.slice(queryIndex),
  };
}

async function loadRouteModule(importPath: string): Promise<Record<string, RouteHandler>> {
  const cached = routeModuleCache.get(importPath);
  if (cached) {
    return cached;
  }

  const module = await import(importPath);
  routeModuleCache.set(importPath, module);
  return module;
}

async function resolveRoute(
  method: HttpMethod,
  path: string,
): Promise<{ handler: RouteHandler; params: Record<string, string> }> {
  const { pathname } = splitPathAndQuery(path);

  for (const route of ROUTE_DEFINITIONS) {
    const match = pathname.match(route.pattern);
    if (!match) {
      continue;
    }

    const module = await loadRouteModule(route.importPath);
    const handler = module[method];
    if (!handler) {
      throw new Error(`Method ${method} not supported for ${pathname}`);
    }

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return { handler, params };
  }

  throw new Error(`No route handler found for ${method} ${pathname}`);
}

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Headers;
  json(): Promise<T>;
  text(): Promise<string>;
  content: Buffer;
}

async function toApiResponse(response: Response): Promise<ApiResponse> {
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    headers: response.headers,
    async json<T = unknown>() {
      if (buffer.length === 0) {
        return undefined as T;
      }
      return JSON.parse(buffer.toString("utf8")) as T;
    },
    async text() {
      return buffer.toString("utf8");
    },
    content: buffer,
  };
}

async function request(
  method: HttpMethod,
  path: string,
  options?: { json?: unknown },
): Promise<ApiResponse> {
  const { pathname, search } = splitPathAndQuery(path);
  const url = `http://localhost:4000${pathname}${search}`;

  const init: RequestInit = { method };
  if (options?.json !== undefined) {
    init.body = JSON.stringify(options.json);
    init.headers = { "Content-Type": "application/json" };
  }

  const nextRequest = new NextRequest(url, init);
  const { handler, params } = await resolveRoute(method, path);

  const response =
    Object.keys(params).length === 0
      ? await handler(nextRequest)
      : await handler(nextRequest, { params: Promise.resolve(params) });

  return toApiResponse(response);
}

export const apiClient = {
  get(path: string) {
    return request("GET", path);
  },
  post(path: string, options?: { json?: unknown }) {
    return request("POST", path, options);
  },
  patch(path: string, options?: { json?: unknown }) {
    return request("PATCH", path, options);
  },
  put(path: string, options?: { json?: unknown }) {
    return request("PUT", path, options);
  },
  delete(path: string) {
    return request("DELETE", path);
  },
};

export type ApiClient = typeof apiClient;
