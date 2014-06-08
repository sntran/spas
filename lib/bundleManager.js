"use strict";

var _ = require( 'lodash' )
  , fs = require( 'fs' )
  , uuid = require( 'node-uuid' )
  , winston = require( '../lib/logging' ).winston;

module.exports = function ( options ) {
  options || ( options = {} );
  var directory = options.directory || ( process.cwd() + '/bundles' )
    , bundles
    ;

  refreshBundles();
  monitor();

  // Middleware
  return function *loadBundle ( next ) {
    var ctx = this
      , bid = ctx.params.bid || ctx.subdomains.join( "." )
      ;

    if (!bid) return;
    this.bundle = bundles[ bid ];
    // Done, yield to downstream.
    yield* next;
  };

  // Main functionality
  function refreshBundles ( targetFile ) {
    var files = fs.readdirSync( directory )
      ;

    bundles = {};

    files.forEach( function ( file ) {
      if ( !isBundle( file ) ) { return; }
      if ( targetFile && targetFile.indexOf(file) === -1 ) { return; }

      // if any part fo the bundle is not valid js an error will be thrown and we ignore the rest of the file
      try {
        var bundle = require( directory + '/' + file );
        _.each( bundle, function ( part, key ) {
          winston.info("Bundle \""+key+"\": loaded from \"" + file + "\"");
          bundles[key] = part;
        });
      } catch ( err ) {
        winston.error("Error parsing bundle \""+file+"\": "+err);
      }
    });
  }

  function monitor ( ) {
    winston.info( 'Start monitoring bundle folder %s', directory );

    fs.watch( directory, function ( event, file ) {
      if ( file && file.endsWith( '.js' ) ) {
        winston.event('Bundle file changed: ' + file);
        file = directory + '/' + file;
        refreshBundles( file );
      }
    } );
  }
}

function isBundle( file ) {
  return file.indexOf('.js') !== -1
        && file.indexOf('package.json') === -1 
        && file.indexOf('config.json') === -1 
        && file[0] !== '.'
  ;
}