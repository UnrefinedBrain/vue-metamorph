import { reactive, watch } from 'vue';
import type { FilterSettings } from './tree-adapter';
import { getProperty } from './object-access';

/**
 * Tree view settings, kept across visits the way AST Explorer does.
 */
export type TreeSettings = FilterSettings & {
  /** Follow the cursor: open and scroll to the node under it. */
  autofocus: boolean;
  hideFunctions: boolean;
  hideEmptyKeys: boolean;
  hideLocationData: boolean;
  hideRaws: boolean;
};

const STORAGE_KEY = 'vue-metamorph:playground:tree-settings';

const DEFAULTS: TreeSettings = {
  autofocus: true,
  hideFunctions: true,
  hideEmptyKeys: false,
  hideLocationData: false,
  hideRaws: false,
};

function read(): TreeSettings {
  let stored: unknown;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    stored = raw === null ? undefined : JSON.parse(raw);
  } catch {
    return { ...DEFAULTS };
  }

  const bool = (key: string, fallback: boolean) => {
    const value = getProperty(stored, key);

    return typeof value === 'boolean' ? value : fallback;
  };

  return {
    autofocus: bool('autofocus', DEFAULTS.autofocus),
    hideFunctions: bool('hideFunctions', DEFAULTS.hideFunctions),
    hideEmptyKeys: bool('hideEmptyKeys', DEFAULTS.hideEmptyKeys),
    hideLocationData: bool('hideLocationData', DEFAULTS.hideLocationData),
    hideRaws: bool('hideRaws', DEFAULTS.hideRaws),
  };
}

let settings: TreeSettings | null = null;

export function useTreeSettings(): TreeSettings {
  if (!settings) {
    settings = reactive(read());

    watch(
      () => ({ ...settings }),
      (value) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } catch {
          // storage is full or blocked; the settings still work for this visit
        }
      },
    );
  }

  return settings;
}
