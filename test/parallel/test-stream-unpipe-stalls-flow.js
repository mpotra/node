// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';
require('../common');
const assert = require('assert');
const stream = require('stream');
const util = require('util');

// Construct a chunks array, for consuming in the test.
const numTestChunks = 30;
const chunks = [];
for (let i = 1; i <= numTestChunks; i++) {
  chunks.push(String(i));
}

// Define a Writable class that consumes data.
function TestWriter() {
  stream.Writable.call(this);
}
util.inherits(TestWriter, stream.Writable);

TestWriter.prototype._write = function(buffer, encoding, callback) {
  callback(null);
};

// Define a Readable class that generates data, from the `chunks` array.
function TestReader(length) {
  stream.Readable.call(this);
}
util.inherits(TestReader, stream.Readable);

TestReader.prototype._read = function(size) {
  if (chunks.length) {
    const chunk = chunks.shift();
    this.push(chunk);
    this.emit('_chunkRead', chunk);
  } else {
    this.push(null);

    const reader = this;
    // Allow any pending `data` events to trigger, first.
    process.nextTick(function() {
      reader.emit('_readFinished');
    });
  }
};

let destUnpiped = false;

const dest = new TestWriter();
const src = new TestReader();

const counter = {
  numDataEvents: 0,
  numChunksRead: 0
};

// Count `data` events.
src.on('data', function() {
  counter.numDataEvents++;
});

// Count internal `_chunkRead` events.
src.on('_chunkRead', function() {
  counter.numChunksRead++;

  // After 10 chunk reads, unpipe dest.
  if (counter.numChunksRead === 10) {
    src.unpipe(dest);
  }
});

dest.on('unpipe', function() {
  destUnpiped = true;
});

src.pipe(dest);

src.on('_readFinished', function() {
  // Destination was unpiped.
  assert.strictEqual(destUnpiped, true);
  // The initial `data` event listener is still attached.
  assert.strictEqual(src.listeners('data').length, 1);
  // The number of _chunkRead events recorded, must match number of test chunks.
  assert.strictEqual(counter.numChunksRead, numTestChunks);
  // The number of data events recorded, must match number of test chunks.
  assert.strictEqual(counter.numDataEvents, numTestChunks);
});

process.on('exit', function() {
  console.log('ok');
});
