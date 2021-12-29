const path = require('path');
const compiler = require(path.join(__dirname, 'addon/build/Release/addon'));

const source = process.argv[2];
const output_path = process.argv[3];
const step_mode = process.argv[4];
compiler.compile(source, output_path, step_mode === 'true');
