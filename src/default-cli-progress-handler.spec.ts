import {
  vi, it, beforeEach,
  expect,
  type Mocked,
} from 'vitest';
import cliProgress from 'cli-progress';
import { createDefaultCliProgressHandler } from './default-cli-progress-handler';

vi.mock('cli-progress');
const cliProgressMock = vi.mocked(cliProgress, true);

let bar: Mocked<cliProgress.SingleBar>;
let handler: ReturnType<typeof createDefaultCliProgressHandler>;

const consoleMock = {
  log: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();

  bar = {
    start: vi.fn(),
    stop: vi.fn(),
    update: vi.fn(),
  } as never;
  cliProgressMock.SingleBar.mockImplementation(() => bar as never);

  handler = createDefaultCliProgressHandler(consoleMock);
});

const startProgress = () => {
  handler({
    aborted: false,
    done: false,
    errors: [],
    filesProcessed: 0,
    filesRemaining: 1,
    manualMigrations: [],
    stats: {},
    totalFiles: 1,
  });
};

it('should start the progress bar when processedFiles = 0', () => {
  startProgress();

  expect(bar.start).toHaveBeenCalledWith(1, 0, { errors: 0 });
});

it('should call bar.update() when not aborted or done', () => {
  startProgress();

  handler({
    aborted: false,
    done: false,
    errors: [],
    filesProcessed: 1,
    filesRemaining: 0,
    manualMigrations: [],
    stats: {},
    totalFiles: 1,
  });

  expect(bar.update).toHaveBeenCalledWith(1, { errors: 0 });
});

it('should stop the progress bar when done = true', () => {
  startProgress();

  handler({
    aborted: false,
    done: true,
    errors: [],
    filesProcessed: 1,
    filesRemaining: 0,
    manualMigrations: [],
    stats: {},
    totalFiles: 1,
  });

  expect(bar.stop).toHaveBeenCalled();
});

it('should stop the progress bar when aborted = true', () => {
  startProgress();

  handler({
    aborted: true,
    done: false,
    errors: [],
    filesProcessed: 1,
    filesRemaining: 0,
    manualMigrations: [],
    stats: {},
    totalFiles: 1,
  });

  expect(bar.stop).toHaveBeenCalled();
});

it('should print errors', () => {
  startProgress();

  handler({
    aborted: false,
    done: true,
    errors: [{
      filename: 'file1.ts',
      error: new Error('file1 error'),
    }, {
      filename: 'file2.js',
      error: new Error('file2 error'),
    }],
    filesProcessed: 1,
    filesRemaining: 0,
    manualMigrations: [],
    stats: {},
    totalFiles: 1,
  });

  expect(consoleMock.log).toHaveBeenCalledWith(expect.stringContaining('errors:'));
  expect(consoleMock.log).toHaveBeenCalledWith(expect.stringContaining('file1.ts:\nError: file1 error'));
  expect(consoleMock.log).toHaveBeenCalledWith(expect.stringContaining('file2.js:\nError: file2 error'));
});

it('should not print errors if there are 0 errors', () => {
  startProgress();

  handler({
    aborted: false,
    done: true,
    errors: [],
    filesProcessed: 1,
    filesRemaining: 0,
    manualMigrations: [],
    stats: {},
    totalFiles: 1,
  });

  expect(consoleMock.log).not.toHaveBeenCalledWith(expect.stringContaining('errors:'));
});

it('should print stats', () => {
  startProgress();

  handler({
    aborted: false,
    done: true,
    errors: [],
    filesProcessed: 1,
    filesRemaining: 0,
    manualMigrations: [],
    stats: {
      transform1: 1,
    },
    totalFiles: 1,
  });

  expect(consoleMock.log).toHaveBeenCalledWith(expect.stringMatching(/transform1 +│ 1/));
});

it('should print manual migrations', () => {
  startProgress();

  handler({
    aborted: false,
    done: true,
    errors: [],
    filesProcessed: 1,
    filesRemaining: 0,
    manualMigrations: [{
      file: 'file1.js',
      columnEnd: 12,
      columnStart: 10,
      lineEnd: 2,
      lineStart: 1,
      message: 'file1 message',
      pluginName: 'plugin',
      snippet: 'file1 snippet',
    }],
    stats: {},
    totalFiles: 1,
  });

  expect(consoleMock.log).toHaveBeenCalledWith(expect.stringMatching(/manual migration/i));
  expect(consoleMock.log).toHaveBeenCalledWith(expect.stringMatching(/file1\.js\s+1:10-2:12.+file1 message.+file1 snippet/gsi));
});

it('should not print manual migrations if there are 0 manual migrations', () => {
  startProgress();

  handler({
    aborted: false,
    done: true,
    errors: [],
    filesProcessed: 1,
    filesRemaining: 0,
    manualMigrations: [],
    stats: {},
    totalFiles: 1,
  });

  expect(consoleMock.log).not.toHaveBeenCalledWith(expect.stringMatching(/manual migration/i));
});
