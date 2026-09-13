/**
 * Puts the editor contents in the URL so a snippet can be handed to someone
 * else - the reason most people reach for an AST viewer in a bug report.
 */

import { getStringProperty } from './object-access';

export type SharedState = {
  type: string;
  code: string;
  codemod: string;
};

const HASH_PREFIX = '#state=';

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function readSharedState(): SharedState | null {
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(fromBase64Url(hash.slice(HASH_PREFIX.length)));
    const code = getStringProperty(parsed, 'code');

    if (code === undefined) {
      return null;
    }

    return {
      type: getStringProperty(parsed, 'type') ?? 'vue',
      code,
      codemod: getStringProperty(parsed, 'codemod') ?? '',
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(state: SharedState): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${HASH_PREFIX}${toBase64Url(JSON.stringify(state))}`;
}
