"use strict";

var thunkify = require('thunkify')
  , _ = require( 'lodash' )
  , winston = require( '../lib/logging' ).winston
  , configs = require( '../lib/config' );
  
require('date-utils');

module.exports.fulfill = function () {
  return function *fulfill( next ) {
    var bid = this.params.bid || this.subdomains.join( "." )
      , bundle = this.bundle
      , now = new Date()
      ;

    if (!bid) {
      this.status = 400
      return false;
    }
    if ( _.some( bundle, 'auth' ) ) {
      // If any of the API needs auth, yield to auth middleware to
      // fill api.credentials.
      yield next;
    }

    winston.info('exports.fulfill: ' + bid);
    var results = yield retrieveBundle( bid, bundle, this.body );

    // Perform cleanup function on bundle.
    if ( _.has( bundle, 'cleanup' ) ) {
      results = bundle.cleanup( bundle );
    }

    // The bundle expires as the earliest API.
    var expires = results.expires = _.min( results, function ( val ) { 
      return val.expires; 
    } ).expires;
    results.lastModified = now;
    results.secleft = ( expires && expires.getSecondsBetween( now ) * -1 ) || 3600;

    // Set `Expires` header for the cache to store.
    this.set( 'Expires', expires );
    this.body = results;
  }
}

function * retrieveBundle ( bid, def, cachedPart ) {
  var generators = {};
  _.each( def, function ( api, key ) {
    if ( [ 'cleanup', 'callback', 'expiration', 'locked' ].indexOf( key ) > 0 ) return;
    
    if ( cachedPart && cachedPart[ key ] ) {
      // We already have this api cached, skip.
      generators[ key ] = cachedPart[ key ];
      return;
    };

    api.credentials || ( api.credentials = {} );

    generators[ key ] = fulfillPart( api, bid, key );
  });

  return yield generators;
};

function * fulfillPart ( api, bid, key, override, cachedPart ) {
  winston.info('manager:fulfillPart: ' + bid + '.' + key + ', override: '+override);

  var result;

  if ( api.auth && !( api.credentials.access_token ) ) {
    // Not enough authentication data.
    result = {
      // Store temporary credentials so that it gets cached but removed
      // before being returned to client.
      expires: new Date(),
      redirect: api.credentials.redirect,
      err: { errnum:1, errtxt:"Authentication provider requires code." },
      cname: key
    }
  } else {
    var request = thunkify( api.resource );
    var response = yield request( api.params, api.credentials );

    if ( _.has( api, 'cleanup' ) ) {
      response = api.cleanup( response );
    }

    if ( _.has( api, 'filter' ) ) {
      filter( response, api.filter )
    }

    // Build the stored response
    result = {
      expires: (new Date()).addSeconds( api.cacheduration ),
      result: response,
      iid: api.iid,
      cname: key
    }
}

  return result;
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