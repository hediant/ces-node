// Ensure we're in the project directory, so relative paths work as expected
// no matter where we actually lift from.
process.chdir(__dirname);

// Ensure a "ces" can be located:
(function() {
  var ces;
  try {
    ces = require('ces-node');
  } catch (e) {
    console.error('To run an app using `node app.js`, you usually need to have a version of `ces-node` installed in the same directory as your app.');
    console.error('To do that, run `npm install ces-node`');
    console.error('');
    console.error('Alternatively, if you have ces installed globally (i.e. you did `npm install -g ces-node`).');
    console.error('When you run it, your app will still use a local `./node_modules/ces-node` dependency if it exists,');
    console.error('but if it doesn\'t, the app will run with the global ces instead!');
    return;
  }

  // Try to get `rc` dependency
  var rc;
  try {
    rc = require('rc');
  } catch (e0) {
    try {
      rc = require('./node_modules/rc');
    } catch (e1) {
      console.error('Could not find dependency: `rc`.');
      console.error('Your `.cesrc` file(s) will be ignored.');
      console.error('To resolve this, run:');
      console.error('npm install rc --save');
      rc = function () { return {}; };
    }
  }


  // Start server
  ces.lift(__dirname, rc('ces'));
})();

