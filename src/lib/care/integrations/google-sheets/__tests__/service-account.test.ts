import { describe, expect, it } from "vitest";
import { parseServiceAccountJson } from "@/lib/care/integrations/google-sheets/service-account";

describe("parseServiceAccountJson", () => {
  it("parses minimal JSON", () => {
    const creds = parseServiceAccountJson(
      '{"client_email":"a@b.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\\nline\\n-----END PRIVATE KEY-----\\n"}',
    );
    expect(creds.client_email).toBe("a@b.iam.gserviceaccount.com");
    expect(creds.private_key).toContain("\n");
  });

  it("strips outer single quotes", () => {
    const creds = parseServiceAccountJson(
      `'{"client_email":"a@b.iam.gserviceaccount.com","private_key":"x"}'`,
    );
    expect(creds.client_email).toBe("a@b.iam.gserviceaccount.com");
  });
});
