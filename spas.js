/*

███████╗██████╗  █████╗ ███████╗
██╔════╝██╔══██╗██╔══██╗██╔════╝
███████╗██████╔╝███████║███████╗
╚════██║██╔═══╝ ██╔══██║╚════██║
███████║██║     ██║  ██║███████║
╚══════╝╚═╝     ╚═╝  ╚═╝╚══════╝

Command line parameters

  ## Logging
  ----------------------------------------------------------------------
  To set logging level use command line argument "--log loglevel"

  The valid values for loglevel are:

    error - Logs SPAS errors only
    warn - Adds communication issues with 3rd party API's
    data - [default] Adds all billable transaction events (request to API's & request for bundles)
    info - Adds program flow (function calls, enqueued jobs, etc)
    debug - Adds all datapoints other than API responses and bundles
    verbose - Adds everything (API Responses, conmpleted bundles, etc).
    input - Adds all requests and passed parameters


  ##  Environment
  ----------------------------------------------------------------------
  spas has two branches in the configuration file: development and live

  Passing the command line argument "--dev" will use the development node, otherwise live will be used


  ## Execution mode
  ----------------------------------------------------------------------
  spas can run as a service by passing the "--service" command line argument.

  Without "--service" spas will run in the console

*/

// Setting up server
var debug = require( 'debug' )( 'spas' );
var responseTime = require( 'koa-response-time' );
var etag = require( 'koa-etag' );
var fresh = require( 'koa-fresh' );
var compress = require( 'koa-compress' );
var logger = require( 'koa-logger' );
var router = require( 'koa-router' );
var mask = require( 'koa-json-mask' );

var configs = require( './lib/config' );
var winston = require( './lib/logging' ).winston;
var CacheManager = require( './lib/cache' );
var BundleManager = require( './lib/bundleManager' );
var engine = require( './lib/engine' );

var koa = require( 'koa' );
var path = require( 'path' );
var app = module.exports = koa();

// At the top before any other middleware, to wrap all subsequent middlewares.
app.use( responseTime() );
app.use( logger() );
app.use( fresh() );
app.use( etag() );
app.use( compress() );
app.use( mask() );
app.use( router( app ) );

// Small fix to prevent request for favicon.ico.
app.get( '/favicon.ico', function *() {
  this.status = 304;
  this.type = "image/x-icon";
} );

// Two middlewares to be used before the actual handler to
// ensure bundles are up-to-date and request from cache if possible.
var bundler = BundleManager( { 
  directory: process.env.BUNDLE_DIR || __dirname + '/bundles'
} )
var cacher = CacheManager( {
  storage: configs.get( 'DATABASE_URL' )
} );

app.get( '/bundle/:bid', bundler, cacher, engine.fulfill() ); // A bundle is being requested using the old, deprecated format 'http://domain.com/bundle/bundlename'
app.get( '/:bid', bundler, cacher, engine.fulfill() ); // A bundle is being requested in the format 'http://domain.com/bundlename'
app.get( '/', bundler, cacher, engine.fulfill() ); // A bundle is being requested in the format 'http://bundlename.domain.com'

app.listen( configs.get( 'PORT' ), function() {
  winston.info( 'SPAS is listening on port %d', configs.get( 'PORT' ) ) ;
});