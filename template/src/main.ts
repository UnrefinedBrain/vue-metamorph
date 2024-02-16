import { createVueMetamorphCli } from 'vue-metamorph';
import process from 'process';

import { helloWorldCodemod } from './plugins/hello-world.js';

const cli = createVueMetamorphCli({
  // register plugins here!
  plugins: [
    helloWorldCodemod,
  ],
});

process.on('SIGQUIT', cli.abort);
process.on('SIGTERM', cli.abort);
process.on('SIGINT', cli.abort);

cli.run();
