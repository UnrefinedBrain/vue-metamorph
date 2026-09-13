/**
 * Returns the value at `key`, or `undefined` if `value` isn't an object.
 *
 * The lookup walks the prototype chain, the same way indexing does, because ast-types puts
 * field defaults on node prototypes.
 */
export function getProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return Reflect.get(value, key);
}

export function getStringProperty(value: unknown, key: string): string | undefined {
  const found = getProperty(value, key);

  return typeof found === 'string' ? found : undefined;
}

export function getNumberProperty(value: unknown, key: string): number | undefined {
  const found = getProperty(value, key);

  return typeof found === 'number' ? found : undefined;
}
