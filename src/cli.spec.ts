import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { CodemodPlugin, ManualMigrationPlugin } from './types';

vi.mock('./default-cli-progress-handler', () => ({
  createDefaultCliProgressHandler: vi.fn(() => vi.fn()),
}));

const { createVueMetamorphCli } = await import('./cli');
const { createDefaultCliProgressHandler } = await import('./default-cli-progress-handler');

let tmpDir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  tmpDir = await fs.mkdtemp(path.join(tmpdir(), 'vmm-cli-spec-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const writeFile = async (rel: string, contents: string) => {
  const full = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, contents);
  return full;
};

const argv = (...args: string[]) => ['node', 'cli', ...args];

const lastProgressCall = (onProgress: ReturnType<typeof vi.fn>) =>
  onProgress.mock.calls.at(-1)![0] as {
    totalFiles: number;
    filesProcessed: number;
    filesRemaining: number;
    aborted: boolean;
    done: boolean;
    stats: Record<string, number>;
    errors: { filename: string; error: Error }[];
    manualMigrations: { file: string; pluginName: string }[];
  };

describe('createVueMetamorphCli', () => {
  describe('file globbing', () => {
    it('only picks up files with supported extensions', async () => {
      await writeFile('a.vue', '<template><div /></template>');
      await writeFile('b.ts', 'const x = 1;');
      await writeFile('c.css', '.foo { color: red; }');
      await writeFile('d.md', '# ignored');
      await writeFile('e.json', '{}');

      const seen: string[] = [];
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'collect',
        transform({ filename }) {
          seen.push(path.basename(filename));
          return 0;
        },
      };

      const onProgress = vi.fn();
      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      await run(argv('--files', `${tmpDir}/**/*`));

      expect(seen.sort()).toEqual(['a.vue', 'b.ts', 'c.css']);
      expect(lastProgressCall(onProgress).totalFiles).toBe(3);
    });

    it('ignores files under node_modules', async () => {
      await writeFile('keep.ts', 'const x = 1;');
      await writeFile('node_modules/pkg/index.ts', 'const x = 1;');

      const seen: string[] = [];
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'collect',
        transform({ filename }) {
          seen.push(filename);
          return 0;
        },
      };

      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true });
      await run(argv('--files', `${tmpDir}/**/*`));

      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatch(/keep\.ts$/);
    });
  });

  describe('--list-plugins', () => {
    it('prints plugin names and returns without running codemods', async () => {
      await writeFile('a.ts', 'const x = 1;');
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      let transformCalls = 0;
      const plugins: CodemodPlugin[] = [
        {
          type: 'codemod',
          name: 'one',
          transform: () => {
            transformCalls++;
            return 0;
          },
        },
        {
          type: 'codemod',
          name: 'two',
          transform: () => {
            transformCalls++;
            return 0;
          },
        },
      ];
      const { run } = createVueMetamorphCli({ plugins, silent: true });

      await run(argv('--files', `${tmpDir}/**/*`, '--list-plugins'));
      expect(writeSpy).toHaveBeenCalledWith('one\ntwo\n');
      expect(transformCalls).toBe(0);

      writeSpy.mockRestore();
    });
  });

  describe('--plugins filter', () => {
    it('uses micromatch against plugin names', async () => {
      await writeFile('a.ts', 'const x = 1;');

      const calls: string[] = [];
      const mk = (name: string): CodemodPlugin => ({
        type: 'codemod',
        name,
        transform: () => {
          calls.push(name);
          return 0;
        },
      });

      const { run } = createVueMetamorphCli({
        plugins: [mk('foo-one'), mk('foo-two'), mk('bar-one')],
        silent: true,
      });
      await run(argv('--files', `${tmpDir}/**/*`, '--plugins', 'foo-*'));

      expect(calls.sort()).toEqual(['foo-one', 'foo-two']);
    });
  });

  describe('plugin type routing', () => {
    it('routes codemod and manual plugins by type', async () => {
      await writeFile('a.ts', 'const greeting = "before";');

      const manualCalls: string[] = [];
      const codemod: CodemodPlugin = {
        type: 'codemod',
        name: 'rewrite-literal',
        transform({ scriptASTs, utils: { traverseScriptAST } }) {
          let count = 0;
          for (const ast of scriptASTs) {
            traverseScriptAST(ast, {
              visitLiteral(p) {
                if (typeof p.node.value === 'string') {
                  p.node.value = 'after';
                  count++;
                }
                return this.traverse(p);
              },
            });
          }
          return count;
        },
      };

      const manual: ManualMigrationPlugin = {
        type: 'manual',
        name: 'report-literal',
        find({ scriptASTs, report, utils: { traverseScriptAST } }) {
          for (const ast of scriptASTs) {
            traverseScriptAST(ast, {
              visitLiteral(p) {
                if (typeof p.node.value === 'string') {
                  manualCalls.push(String(p.node.value));
                  report(p.node, 'literal found');
                }
                return this.traverse(p);
              },
            });
          }
        },
      };

      const onProgress = vi.fn();
      const { run } = createVueMetamorphCli({
        plugins: [codemod, manual],
        silent: true,
        onProgress,
      });
      await run(argv('--files', `${tmpDir}/**/*`));

      const written = await fs.readFile(path.join(tmpDir, 'a.ts'), 'utf-8');
      expect(written).toContain("'after'");
      expect(manualCalls).toEqual(['after']);
      const final = lastProgressCall(onProgress);
      expect(final.manualMigrations).toHaveLength(1);
      expect(final.manualMigrations[0]!.pluginName).toBe('report-literal');
    });
  });

  describe('plugin array flattening', () => {
    it('flattens nested plugin arrays', async () => {
      await writeFile('a.ts', 'const x = 1;');

      const seen: string[] = [];
      const mk = (name: string): CodemodPlugin => ({
        type: 'codemod',
        name,
        transform: () => {
          seen.push(name);
          return 0;
        },
      });

      const { run } = createVueMetamorphCli({
        plugins: [[mk('a'), mk('b')], mk('c')],
        silent: true,
      });
      await run(argv('--files', `${tmpDir}/**/*`));

      expect(seen.sort()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('error handling', () => {
    it('captures plugin errors without killing the run', async () => {
      await writeFile('a.ts', 'const x = 1;');
      await writeFile('b.ts', 'const y = 2;');

      let calls = 0;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'sometimes-throws',
        transform({ filename }) {
          calls++;
          if (filename.endsWith('a.ts')) {
            throw new Error('boom');
          }
          return 0;
        },
      };

      const onProgress = vi.fn();
      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      await run(argv('--files', `${tmpDir}/**/*`));

      expect(calls).toBe(2);
      const final = lastProgressCall(onProgress);
      expect(final.done).toBe(true);
      expect(final.errors).toHaveLength(1);
      expect(final.errors[0]!.error.message).toBe('boom');
      expect(final.errors[0]!.filename).toMatch(/a\.ts$/);
    });
  });

  describe('abort()', () => {
    it('stops processing before the next file', async () => {
      await writeFile('a.ts', 'const x = 1;');
      await writeFile('b.ts', 'const y = 2;');
      await writeFile('c.ts', 'const z = 3;');

      let abortFn: (() => void) | null = null;
      let calls = 0;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'self-abort',
        transform() {
          calls++;
          abortFn!();
          return 0;
        },
      };

      const onProgress = vi.fn();
      const cli = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      abortFn = cli.abort;
      await cli.run(argv('--files', `${tmpDir}/**/*`));

      expect(calls).toBe(1);
      const final = lastProgressCall(onProgress);
      expect(final.aborted).toBe(true);
      expect(final.done).toBe(false);
    });

    it('can run again after a previous run was aborted', async () => {
      await writeFile('a.ts', 'const x = 1;');
      await writeFile('b.ts', 'const y = 2;');

      let abortFn: (() => void) | null = null;
      let calls = 0;
      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'maybe-abort',
        transform() {
          calls++;
          if (calls === 1) abortFn!();
          return 0;
        },
      };

      const onProgress = vi.fn();
      const cli = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      abortFn = cli.abort;

      await cli.run(argv('--files', `${tmpDir}/**/*`));
      expect(lastProgressCall(onProgress).aborted).toBe(true);

      await cli.run(argv('--files', `${tmpDir}/**/*`));
      const second = lastProgressCall(onProgress);
      expect(second.aborted).toBe(false);
      expect(second.done).toBe(true);
      expect(second.filesProcessed).toBe(2);
    });
  });

  describe('progress callback', () => {
    it('reports done: true in the final event of a normal run', async () => {
      await writeFile('a.ts', 'const x = 1;');
      await writeFile('b.ts', 'const y = 2;');

      const onProgress = vi.fn();
      const plugin: CodemodPlugin = { type: 'codemod', name: 'noop', transform: () => 0 };
      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      await run(argv('--files', `${tmpDir}/**/*`));

      const final = lastProgressCall(onProgress);
      expect(final.done).toBe(true);
      expect(final.aborted).toBe(false);
      expect(final.filesProcessed).toBe(2);
      expect(final.filesRemaining).toBe(0);
      expect(final.totalFiles).toBe(2);
    });

    it('reports the correct filesProcessed in intermediate events', async () => {
      await writeFile('a.ts', 'const x = 1;');
      await writeFile('b.ts', 'const y = 2;');
      await writeFile('c.ts', 'const z = 3;');

      const onProgress = vi.fn();
      const plugin: CodemodPlugin = { type: 'codemod', name: 'noop', transform: () => 0 };
      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      await run(argv('--files', `${tmpDir}/**/*`));

      const events = onProgress.mock.calls.map(([p]) => ({
        processed: p.filesProcessed,
        remaining: p.filesRemaining,
        total: p.totalFiles,
        done: p.done,
      }));
      // One progress event per file plus the final done event.
      expect(events).toEqual([
        { processed: 1, remaining: 2, total: 3, done: false },
        { processed: 2, remaining: 1, total: 3, done: false },
        { processed: 3, remaining: 0, total: 3, done: false },
        { processed: 3, remaining: 0, total: 3, done: true },
      ]);
    });

    it('emits a progress event for files whose plugins throw', async () => {
      await writeFile('a.ts', 'const x = 1;');
      await writeFile('b.ts', 'const y = 2;');

      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'boom',
        transform: () => {
          throw new Error('boom');
        },
      };

      const onProgress = vi.fn();
      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      await run(argv('--files', `${tmpDir}/**/*`));

      // 2 intermediate events + 1 done event, even though every file errored.
      expect(onProgress).toHaveBeenCalledTimes(3);
    });

    it('accumulates per-plugin stats across files', async () => {
      await writeFile('a.ts', 'const x = 1;');
      await writeFile('b.ts', 'const y = 2;');

      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'counter',
        transform: () => 3,
      };

      const onProgress = vi.fn();
      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      await run(argv('--files', `${tmpDir}/**/*`));

      expect(lastProgressCall(onProgress).stats).toEqual({ counter: 6 });
    });
  });

  describe('silent option', () => {
    it('skips the default progress handler when silent: true', async () => {
      await writeFile('a.ts', 'const x = 1;');

      const defaultHandler = vi.fn();
      vi.mocked(createDefaultCliProgressHandler).mockReturnValue(defaultHandler);

      const onProgress = vi.fn();
      const plugin: CodemodPlugin = { type: 'codemod', name: 'noop', transform: () => 0 };
      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true, onProgress });
      await run(argv('--files', `${tmpDir}/**/*`));

      expect(defaultHandler).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalled();
    });

    it('invokes the default progress handler when silent is not set', async () => {
      await writeFile('a.ts', 'const x = 1;');

      const defaultHandler = vi.fn();
      vi.mocked(createDefaultCliProgressHandler).mockReturnValue(defaultHandler);

      const plugin: CodemodPlugin = { type: 'codemod', name: 'noop', transform: () => 0 };
      const { run } = createVueMetamorphCli({ plugins: [plugin] });
      await run(argv('--files', `${tmpDir}/**/*`));

      expect(defaultHandler).toHaveBeenCalled();
    });
  });

  describe('file writing', () => {
    it('writes a file when a codemod reports count > 0', async () => {
      const filePath = await writeFile('a.ts', 'const greeting = "before";');

      const plugin: CodemodPlugin = {
        type: 'codemod',
        name: 'rewrite',
        transform({ scriptASTs, utils: { traverseScriptAST } }) {
          let count = 0;
          for (const ast of scriptASTs) {
            traverseScriptAST(ast, {
              visitLiteral(p) {
                if (typeof p.node.value === 'string') {
                  p.node.value = 'after';
                  count++;
                }
                return this.traverse(p);
              },
            });
          }
          return count;
        },
      };

      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true });
      await run(argv('--files', `${tmpDir}/**/*`));

      expect(await fs.readFile(filePath, 'utf-8')).toContain("'after'");
    });

    it('does not write a file when every codemod returns 0', async () => {
      const filePath = await writeFile('a.ts', 'const x = 1;');
      const before = await fs.stat(filePath);

      const plugin: CodemodPlugin = { type: 'codemod', name: 'noop', transform: () => 0 };
      const { run } = createVueMetamorphCli({ plugins: [plugin], silent: true });
      await run(argv('--files', `${tmpDir}/**/*`));

      const after = await fs.stat(filePath);
      expect(after.mtimeMs).toBe(before.mtimeMs);
    });
  });

  describe('additionalCliOptions', () => {
    it('exposes user-defined options via opts()', async () => {
      const cli = createVueMetamorphCli({
        plugins: [],
        silent: true,
        additionalCliOptions(program) {
          program.option('--flavor <name>', 'pick a flavor');
        },
      });

      expect(cli.opts(argv('--files', `${tmpDir}/**/*`, '--flavor', 'vanilla'))).toMatchObject({
        flavor: 'vanilla',
      });
    });
  });
});
