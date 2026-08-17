export async function register() {
  if (process.env.WEBCONTAINER !== "true") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const proxyBase = process.env.PROXY_URL;
  const proxyApiKey = process.env.PROXY_API_KEY;
  if (!proxyBase || !proxyApiKey) return;

  const proxyUrl = new URL(proxyBase);

  // ---------- 1) Patch http/https.request ----------
  try {
    const _require = eval("require") as typeof require;
    const https = _require("https") as typeof import("https");
    const http = _require("http") as typeof import("http");

    function patchModule(mod: typeof https | typeof http) {
      const original = mod.request.bind(mod);

      mod.request = (options: any, callback?: any) => {
        if (typeof options === "string" || options instanceof URL) {
          const u = new URL(options.toString());
          options = {
            protocol: u.protocol,
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            headers: {},
          };
        }

        const host = options.hostname || options.host || "";
        if (
          !host ||
          host === proxyUrl.hostname ||
          host === "localhost" ||
          host === "127.0.0.1"
        ) {
          return original(options, callback);
        }

        const targetHost = `${options.protocol || "https:"}//${host}${
          options.port ? `:${options.port}` : ""
        }`;

        return original(
          {
            ...options,
            hostname: proxyUrl.hostname,
            host: proxyUrl.hostname,
            port: proxyUrl.port || 443,
            protocol: proxyUrl.protocol,
            headers: {
              ...options.headers,
              "x-proxy-target": targetHost,
              "x-agent-api-key": proxyApiKey,
            },
          },
          callback,
        );
      };
    }

    patchModule(https);
    patchModule(http);
  } catch {
    /* ignore */
  }

  // ---------- 2) Build patched fetch ----------
  const originalFetch = globalThis.fetch;

  const patchedFetch: typeof fetch = ((input: any, init?: any) => {
    const url = input instanceof Request ? input.url : String(input);
    if (
      !url.startsWith("http") ||
      url.includes("localhost") ||
      url.startsWith(proxyBase)
    ) {
      return originalFetch(input, init);
    }
    const target = new URL(url);
    // When input is a Request the SDK puts all headers (incl. Authorization)
    // on the Request object itself; init is undefined in that case.
    const rawHeaders =
      input instanceof Request
        ? input.headers
        : init?.headers instanceof Headers
          ? init.headers
          : new Headers(init?.headers ?? {});
    const existingHeaders = Object.fromEntries(rawHeaders.entries());

    const method = input instanceof Request ? input.method : init?.method;
    const body = input instanceof Request ? input.body : init?.body;

    return originalFetch(`${proxyBase}${target.pathname}${target.search}`, {
      ...init,
      method,
      body,
      // Required by the Fetch spec when body is a ReadableStream (Node 18+)
      ...(body != null ? { duplex: "half" } : {}),
      headers: {
        ...existingHeaders,
        "x-proxy-target": `${target.protocol}//${target.host}`,
        "x-agent-api-key": proxyApiKey,
      },
    } as RequestInit);
  }) as any;

  // ---------- 3) Lock globalThis.fetch ----------
  // Next.js otherwise replaces fetch with its own caching wrapper that
  // bypasses the proxy. A getter + no-op setter ensures every fetch()
  // call resolves to our patched version.
  try {
    Object.defineProperty(globalThis, "fetch", {
      get: () => patchedFetch,
      set: () => {
        /* silently ignore reassignment */
      },
      configurable: false,
    });
  } catch {
    globalThis.fetch = patchedFetch;
  }
}
