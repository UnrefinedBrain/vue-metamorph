import { reactive, watch } from 'vue';
import type { FilterSettings } from './tree-adapter';

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
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored
      ? { ...DEFAULTS, ...(JSON.parse(stored) as Partial<TreeSettings>) }
      : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
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
