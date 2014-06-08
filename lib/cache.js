"use strict";

var Redis = require( 'redis' )
  , wrapper = require( 'co-redis' )
  , urlParser = require( 'url' ).parse
  ;

module.exports = function( options ) {
  options || ( options = {} );
  var prefix = options.prefix || 'spas-cache:'
    , storage = options.storage || 'redis://localhost:6379'
    , parsedUrl = urlParser( storage )
    , port = parsedUrl.port
    , host = parsedUrl.hostname
    , auth = parsedUrl.auth
    , client = wrapper( Redis.createClient( port, host ) )
    ;

  if (auth) { 
    client.auth( auth.split( ":" )[1] );
  }

  return function *cache ( next ) {
    var ctx = this
      , bid = ctx.params.bid || ctx.subdomains.join( "." )
      , bundleKey = prefix + 'bundle:' + bid
      ;
    if (!bid) { return; } // Only handle routes with bid.
    
    try {
      var value = yield client.get( bundleKey );

      if (value) {
        var results = JSON.parse( value );
        results.fromcache = true;

        ctx.status = 200;
        ctx.body = results;
        return;
      }
    } catch( e ) {}

    // Wait for the next middleware to update with possibly new data.
    yield *next;

    var body = ctx.body;
    try {
      if ((ctx.method !== 'GET') || (ctx.status !== 200) || !body) {
        return;
      }

      if ((typeof body === 'string') || Buffer.isBuffer(body)) {
        // string, buffer
        yield client.setex( bundleKey, expire, body );
        return;
      }

      if (typeof body.pipe !== 'function') {
        // json
        yield client.setex( bundleKey, expire, JSON.stringify( body ) );
        return;
      }
    } catch( e ) {}
  }
}