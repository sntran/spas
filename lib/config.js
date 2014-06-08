var config = require('nconf');

var env = process.env.NODE_ENV || "development";

if ( env === "prod" ) env = "production";
if ( env === "dev" ) env = "development"; 

module.exports = config.argv().env().file( {
  file: process.cwd() + '/configs/' + env + '.json'
} );