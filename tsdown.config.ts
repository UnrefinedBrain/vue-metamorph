import { defineConfig } from 'tsdown';

const thirdPartyNotice = `/*!
 * This file bundles third-party code, used under the MIT License:
 *
 *   ast-types  — Copyright (c) 2013 Ben Newman
 *                https://github.com/benjamn/ast-types
 *                (via https://github.com/pionxzh/ast-types-x)
 *   recast     — Copyright (c) 2012 Ben Newman
 *                https://github.com/benjamn/recast
 *                (via https://github.com/pionxzh/recast-x)
 *   deep-diff  — Copyright (c) 2011-2018 Phillip Clark
 *                https://github.com/flitbit/diff
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */`;

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  dts: false,
  clean: false,
  outputOptions: {
    banner: thirdPartyNotice,
  },
});
