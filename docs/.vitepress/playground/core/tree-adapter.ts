/**
 * Ported from AST Explorer (https://github.com/fkling/astexplorer),
 * website/src/core/TreeAdapter.js - MIT, Copyright (c) 2014 Felix Kling.
 *
 * Everything the tree view knows about the shape of an AST goes through here:
 * how to walk a node, what to call it, where it lives in the source, and which
 * properties are noise.
 */

export type Range = [start: number, end: number];

export type TreeProperty = {
  key: string;
  value: unknown;
  computed?: boolean;
};

export type TreeFilter = {
  /** Settings key that turns the filter on. Filters without one always apply. */
  key?: string;
  label?: string;
  test(value: unknown, key: string, fromArray: boolean): boolean;
};

export type TreeAdapterOptions = {
  filters?: TreeFilter[];
  /** Keys that hold source positions, never worth focusing on their own. */
  locationProps?: Set<string>;
  openByDefault(node: unknown, key: string | undefined): boolean;
  nodeToRange(node: unknown): Range | null;
  nodeToName(node: unknown): string | undefined;
  walkNode(node: unknown): Iterable<TreeProperty>;
  /**
   * Moves a range from the AST's coordinate space into the editor's. Script
   * and style blocks of an SFC are parsed out of a rewritten snippet, so their
   * offsets need shifting before they can highlight anything.
   */
  mapRange?(range: Range): Range | null;
};

export type FilterSettings = Record<string, boolean>;

const isValidPosition = (position: number | null): position is number => Number.isInteger(position);

/**
 * Configurable base class for all tree traversal.
 */
export class TreeAdapter {
  private readonly ranges = new WeakMap<object, Range | null>();

  constructor(
    private readonly options: TreeAdapterOptions,
    private readonly filterValues: FilterSettings,
  ) {}

  /**
   * Used by UI components to render an appropriate input for each filter.
   */
  getConfigurableFilters(): (TreeFilter & { key: string; label: string })[] {
    return (this.options.filters ?? []).filter(
      (filter): filter is TreeFilter & { key: string; label: string } =>
        Boolean(filter.key && filter.label),
    );
  }

  /**
   * A more or less human readable name of the node.
   */
  getNodeName(node: unknown): string | undefined {
    return this.options.nodeToName(node);
  }

  /**
   * The start and end indices of the node in the source text, used to
   * highlight source text and to focus nodes in the tree.
   */
  getRange(node: unknown): Range | null {
    if (node == null) {
      return null;
    }

    const cacheable = typeof node === 'object';
    if (cacheable && this.ranges.has(node as object)) {
      return this.ranges.get(node as object) ?? null;
    }

    const raw = this.options.nodeToRange(node);
    const range = raw && this.options.mapRange ? this.options.mapRange(raw) : raw;

    if (cacheable) {
      this.ranges.set(node as object, range);
    }

    return range;
  }

  isInRange(node: unknown, key: string | undefined, position: number | null): boolean {
    if (this.isLocationProp(key) || !isValidPosition(position)) {
      return false;
    }

    const range = this.getRange(node);
    return !!range && range[0] <= position && position <= range[1];
  }

  hasChildrenInRange(
    node: unknown,
    key: string | undefined,
    position: number | null,
    seen = new Set<unknown>(),
  ): boolean {
    if (this.isLocationProp(key) || !isValidPosition(position)) {
      return false;
    }

    seen.add(node);

    if (this.getRange(node) && !this.isInRange(node, key, position)) {
      return false;
    }

    // Not everything that is rendered has location data associated with it
    // (most commonly arrays). In such a case we look for any descendant that
    // does have location data covering the position.
    for (const child of this.walkNode(node)) {
      if (this.isInRange(child.value, child.key, position)) {
        return true;
      }
    }

    for (const child of this.walkNode(node)) {
      if (seen.has(child.value)) {
        continue;
      }
      if (this.hasChildrenInRange(child.value, child.key, position, seen)) {
        return true;
      }
    }

    return false;
  }

  isLocationProp(key: string | undefined): boolean {
    return !!key && !!this.options.locationProps?.has(key);
  }

  /**
   * Whether or not the provided node should be automatically expanded.
   */
  opensByDefault(node: unknown, key: string | undefined): boolean {
    return this.options.openByDefault(node, key);
  }

  isArray(node: unknown): node is unknown[] {
    return Array.isArray(node);
  }

  isObject(node: unknown): node is Record<string, unknown> {
    return Boolean(node) && typeof node === 'object' && !this.isArray(node);
  }

  /**
   * Iterate over each "property" of the node, minus whatever the active
   * filters hide.
   */
  *walkNode(node: unknown): Generator<TreeProperty> {
    if (node == null) {
      return;
    }

    const fromArray = this.isArray(node);

    for (const property of this.options.walkNode(node)) {
      const hidden = (this.options.filters ?? []).some((filter) => {
        if (filter.key && !this.filterValues[filter.key]) {
          return false;
        }
        return filter.test(property.value, property.key, fromArray);
      });

      if (!hidden) {
        yield property;
      }
    }
  }
}

export function ignoreKeysFilter(keys: Set<string>, key?: string, label?: string): TreeFilter {
  return {
    key,
    label,
    test: (_value, propertyKey) => keys.has(propertyKey),
  };
}

export function locationInformationFilter(keys: Set<string>): TreeFilter {
  return ignoreKeysFilter(keys, 'hideLocationData', 'Hide location data');
}

export function functionFilter(): TreeFilter {
  return {
    key: 'hideFunctions',
    label: 'Hide methods',
    test: (value) => typeof value === 'function',
  };
}

export function emptyKeysFilter(): TreeFilter {
  return {
    key: 'hideEmptyKeys',
    label: 'Hide empty keys',
    test: (value, _key, fromArray) => value == null && !fromArray,
  };
}
