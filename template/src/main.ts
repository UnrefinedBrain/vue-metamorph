/* eslint-disable no-console */
import { createvue-metamorphCli } from 'vue-metamorph';
import process from 'process';

import { helloWorldCodemod } from './plugins/hello-world.js';

const cli = createvue-metamorphCli({
  // register plugins here!
  plugins: [
    helloWorldCodemod,
  ],
});

process.on('SIGQUIT', cli.abort);
process.on('SIGTERM', cli.abort);

cli.run();
