import { INSTITUTION_GROUPS } from "@/lib/data/institutions";
import { handleRouteError, jsonOk } from "@/lib/api/route-utils";

export async function GET() {
  try {
    return jsonOk(INSTITUTION_GROUPS);
  } catch (error) {
    return handleRouteError(error);
  }
}
