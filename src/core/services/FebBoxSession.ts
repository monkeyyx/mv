import { DurableObject } from "cloudflare:workers";

/**
 * FebBoxSession Durable Object
 * Manages the singleton session cookie for FebBox globally.
 */
export class FebBoxSession extends DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/get") {
      const cookie = await this.state.storage.get<string>("cookie");
      return new Response(cookie || "");
    }

    if (url.pathname === "/refresh") {
      const { email, password } = await request.json() as any;
      if (!email || !password) {
        return new Response("Missing credentials", { status: 400 });
      }

      console.log(`[FebBoxSession] Refreshing session for ${email}...`);
      
      try {
        const res = await fetch("https://www.febbox.com/account/login_ajax", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
          body: new URLSearchParams({
            account: email,
            password: password,
            keep_login: "1",
          }).toString(),
        });

        const data = await res.json() as any;
        if (data.code !== 1) {
          return new Response(JSON.stringify({ error: "Login failed", detail: data }), { status: 401 });
        }

        // Extract 'ui' cookie from Set-Cookie headers
        const setCookie = res.headers.get("Set-Cookie");
        const match = setCookie?.match(/ui=([^;]+)/);
        const cookie = match ? match[1] : null;

        if (cookie) {
          await this.state.storage.put("cookie", cookie);
          await this.state.storage.put("last_refresh", Date.now());
          console.log("[FebBoxSession] Session refreshed successfully.");
          return new Response(cookie);
        }

        return new Response("Cookie not found in response", { status: 500 });
      } catch (e) {
        return new Response((e as Error).message, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
}
