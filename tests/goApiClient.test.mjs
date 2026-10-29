import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test, { afterEach } from "node:test";

import { loadFloorTemplates } from "../src/services/floorTemplateRepository.ts";
import { goApiClient } from "../src/services/goApiClient.ts";

const configuredBaseURL = goApiClient.defaults.baseURL;
const configuredTimeout = goApiClient.defaults.timeout;

afterEach(() => {
  goApiClient.defaults.baseURL = configuredBaseURL;
  goApiClient.defaults.timeout = configuredTimeout;
});

const profileId = "profile-charge";
const supabase = {
  auth: {
    async getSession() {
      return { data: { session: { access_token: "current-token" } }, error: null };
    },
  },
};

async function serve(t, handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  goApiClient.defaults.baseURL = `http://127.0.0.1:${server.address().port}`;
}

test("shared Axios client sends the relative path, JSON accept header, and per-request bearer token", async (t) => {
  await serve(t, (request, response) => {
    assert.equal(request.url, "/floor-templates");
    assert.equal(request.method, "GET");
    assert.equal(request.headers.authorization, "Bearer current-token");
    assert.equal(request.headers.accept, "application/json");
    assert.equal(request.headers.cookie, undefined);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ templates: [] }));
  });
  assert.deepEqual(await loadFloorTemplates(supabase, profileId), []);
});

test("missing shared base URL fails explicitly", async () => {
  goApiClient.defaults.baseURL = undefined;
  await assert.rejects(
    loadFloorTemplates(supabase, profileId),
    /Add EXPO_PUBLIC_GO_API_URL/,
  );
});

test("real HTTP status errors use the existing controlled message", async (t) => {
  await serve(t, (_request, response) => {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: { message: "private database detail" } }));
  });
  await assert.rejects(
    loadFloorTemplates(supabase, profileId),
    /temporarily unavailable/,
  );
});

test("malformed JSON over HTTP is rejected by template validation", async (t) => {
  await serve(t, (_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end("<html>not JSON</html>");
  });
  await assert.rejects(loadFloorTemplates(supabase, profileId), /invalid response/);
});

test("redirects are rejected without calling their destination", async (t) => {
  let redirected = false;
  await serve(t, (request, response) => {
    if (request.url !== "/floor-templates") {
      redirected = true;
      response.end("{}");
      return;
    }
    response.writeHead(302, { Location: "/redirect-target" });
    response.end();
  });
  await assert.rejects(loadFloorTemplates(supabase, profileId), /Could not reach/);
  assert.equal(redirected, false);
});

test("Axios timeout aborts a stalled request", async (t) => {
  await serve(t, () => {});
  goApiClient.defaults.timeout = 100;
  await assert.rejects(loadFloorTemplates(supabase, profileId), /took too long/);
});

test("Axios timeout also aborts a stalled response body", async (t) => {
  await serve(t, (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.write('{"templates":');
  });
  goApiClient.defaults.timeout = 100;
  await assert.rejects(loadFloorTemplates(supabase, profileId), /took too long/);
});
