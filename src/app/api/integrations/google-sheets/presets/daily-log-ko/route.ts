import { dailyLogKoPresetForApi } from "@/lib/care/integrations/google-sheets/presets/daily-log-ko";
import { jsonResponse } from "@/lib/care/utils";

export async function GET() {
  return jsonResponse(dailyLogKoPresetForApi());
}
