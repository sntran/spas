"use strict";

var thunkify = require('thunkify')
  , _ = require( 'lodash' )
  , winston = require( '../lib/logging' ).winston
  , configs = require( '../lib/config' );
  
require('date-utils');

module.exports.fulfill = function () {
  return function *fulfill( next ) {
    var ctx = this
      , bid = ctx.params.bid || ctx.subdomains.join( "." )
      , bundle = ctx.bundle
      ;

    if (!bid) {
      ctx.status = 400
      return false;
    }

    winston.info('exports.fulfill: ' + bid);
    this.body = yield retrieveBundle( bid, bundle );
  }
}

function * retrieveBundle ( bid, def ) {
  var generators = {};
  _.each( def, function ( api, key ) {
    if (['cleanup', 'callback', 'expiration', 'locked'].indexOf(key) > 0) return;
    api.credentials || (api.credentials = {});

    generators[ key] = fulfillPart( api, bid, key );
  });

  var results = yield generators;

  results.expires = "@TODO";
  results.lastModified = "@TODO";
  results.secleft = "@TODO";
  return results;
};

function * fulfillPart ( api, bid, key, override, cachedPart ) {
  winston.info('manager:fulfillPart: ' + bid + '.' + key + ', override: '+override);
  // @TODO: Perform oauth if needed
  winston.info('manager:startRequest: ' + key);
  var request = thunkify( api.resource );
  var response = yield request( api.params, api.credentials );

  if ( _.has( api, 'cleanup' ) ) {
    response = api.cleanup( response );
  }

  if ( _.has( api, 'filter' ) ) {
    filter( response, api.filter )
  }

  // Build the stored response
  var tout = {
    expires: (new Date()).addSeconds( api.cacheduration ),
    result: response,
    iid: api.iid,
    cname: key
  }

  return tout;
}

//
// ## Recursive function to remove unwanted elements from API response
//
function filter ( source, map ) {
  if ( _.isArray( source ) ) {
    _.each( source, function ( item, index ) { filter( item, map[ 0 ] ); } );
  } else {
    if ( _.isString( source ) || map === true || _.isUndefined( map ) ) return 0;
    _.each( source, function ( obj, key, source ) {
      if ( _.isUndefined( map[ key ] ) ) {
        delete source[ key ];
      } else {
        filter( obj, map[ key ] );
      }
    });
  };  
}