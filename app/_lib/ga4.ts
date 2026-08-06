import { isEnvSet } from "@/app/_lib/format";
import type { LoadedConfig } from "@/src/core/config";
import { listAccessibleGa4Properties } from "@/src/core/connectors/ga4";
import {
  parseGa4PropertyIdsFromEnv,
  type Ga4PropertyInfo,
} from "@/src/core/connectors/ga4-shared";

export function selectedGa4Ids(loaded: LoadedConfig): string[] {
  const entry = loaded.config.connectors.find(
    (connector) => connector.id === "ga4",
  );
  const fromConfig = entry?.config?.properties;
  if (Array.isArray(fromConfig)) {
    const ids = fromConfig
      .map((item) => {
        if (
          item &&
          typeof item === "object" &&
          "id" in item &&
          typeof (item as { id: unknown }).id === "string"
        ) {
          return (item as { id: string }).id;
        }
        return null;
      })
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      return ids;
    }
  }
  return parseGa4PropertyIdsFromEnv(loaded.env).map((property) => property.id);
}

export async function loadGa4PickerState(
  loaded: LoadedConfig,
  rootDir: string,
): Promise<{
  credentialsReady: boolean;
  properties: Ga4PropertyInfo[];
  selectedIds: string[];
  error: string | null;
}> {
  const credentialsReady = isEnvSet(
    "GOOGLE_APPLICATION_CREDENTIALS",
    loaded.env,
  );
  const selectedIds = selectedGa4Ids(loaded);
  if (!credentialsReady) {
    return {
      credentialsReady: false,
      properties: [],
      selectedIds,
      error: null,
    };
  }

  try {
    const properties = await listAccessibleGa4Properties(loaded.env, rootDir);
    return {
      credentialsReady: true,
      properties,
      selectedIds,
      error: null,
    };
  } catch (err) {
    return {
      credentialsReady: true,
      properties: [],
      selectedIds,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
