import { isEnvSet } from "@/app/_lib/format";
import type { LoadedConfig } from "@/src/core/config";
import { listAccessibleGscSites } from "@/src/core/connectors/gsc";
import {
  parseGscSiteUrlsFromEnv,
  type GscSiteInfo,
} from "@/src/core/connectors/gsc-shared";

export function selectedGscSiteUrls(loaded: LoadedConfig): string[] {
  const entry = loaded.config.connectors.find(
    (connector) => connector.id === "gsc",
  );
  const fromConfig = entry?.config?.sites;
  if (Array.isArray(fromConfig)) {
    const urls = fromConfig
      .map((item) => {
        if (
          item &&
          typeof item === "object" &&
          "siteUrl" in item &&
          typeof (item as { siteUrl: unknown }).siteUrl === "string"
        ) {
          return (item as { siteUrl: string }).siteUrl;
        }
        return null;
      })
      .filter((url): url is string => Boolean(url));
    if (urls.length > 0) {
      return urls;
    }
  }
  return parseGscSiteUrlsFromEnv(loaded.env).map((site) => site.siteUrl);
}

export async function loadGscPickerState(
  loaded: LoadedConfig,
  rootDir: string,
): Promise<{
  credentialsReady: boolean;
  sites: GscSiteInfo[];
  selectedUrls: string[];
  error: string | null;
}> {
  const credentialsReady = isEnvSet(
    "GOOGLE_APPLICATION_CREDENTIALS",
    loaded.env,
  );
  const selectedUrls = selectedGscSiteUrls(loaded);
  if (!credentialsReady) {
    return {
      credentialsReady: false,
      sites: [],
      selectedUrls,
      error: null,
    };
  }

  try {
    const sites = await listAccessibleGscSites(loaded.env, rootDir);
    return {
      credentialsReady: true,
      sites,
      selectedUrls,
      error: null,
    };
  } catch (err) {
    return {
      credentialsReady: true,
      sites: [],
      selectedUrls,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
