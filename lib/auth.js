"use strict";

var thunkify = require('thunkify')
  , oauth = require('oauth')
  , OAuth = oauth.OAuth
  , OAuth2 = oauth.OAuth2
  , Redis = require( 'redis' )
  , wrapper = require( 'co-redis' )
  , urlParser = require( 'url' ).parse
  , winston = require( '../lib/logging' ).winston
  , _ = require( 'lodash' )
  ;

module.exports = function ( options ) {
  options || ( options = {} );
  var providers = options.providers
    , prefix = options.prefix || 'spas-cache:'
    , storage = options.storage || 'redis://localhost:6379'
    // , parsedUrl = urlParser( storage )
    // , port = parsedUrl.port
    // , host = parsedUrl.hostname
    // , auth = parsedUrl.auth
    // , client = wrapper( Redis.createClient( port, host ) )
    ;

  return function *maybeAuthenticate ( next ) {
    var bid = this.params.bid || this.subdomains.join( "." )
      , query = this.query
      , bundle = this.bundle
      ;

    if ( !providers ) {
      return;
    }

    if ( query.oauth_token && query.oauth_verifier ) {
      // Callback from authentication service.
      yield _.map( bundle, getAuthAccessToken );
    } else {
      yield _.map( bundle, getAuthRequestToken );
    }
  }

  function * getAuthRequestToken( api, key ) {
    var provider = api.auth && api.auth.provider && providers[ api.auth.provider ];
    if ( !provider ) {
      winston.error( 'Authentication provider ' + api.auth.provider + ' not defined' );
      return api;
    }

    var authenticator = new OAuth(
      provider.requestTemporaryCredentials,
      provider.requestAccessToken,
      provider.oauth_consumer_key,
      provider.client_secret,
      provider.version,
      provider.authorize_callback,
      provider.encryption 
    );

    try {
      var getRequestToken = thunkify( authenticator.getOAuthRequestToken.bind( authenticator ) );
      var callback = yield getRequestToken( );

      api.credentials = {
        'oauth_token': callback[0],
        'oauth_token_secret': callback[1],
        'type': 'oauth',
        'provider': api.auth.provider,
        'redirect': provider.authorize+"?oauth_token="+callback[0]
      }
    } catch ( e ) {
      winston.error( e );
    }

    return api;
  }

  function * getAuthAccessToken( api, key ) {
    var provider = api.auth && api.auth.provider && providers[ api.auth.provider ];
    if ( !provider ) {
      winston.error( 'Authentication provider ' + api.auth.provider + ' not defined' );
      return api;
    }
    var credentials = api.credentials;

    var authenticator = new OAuth(
      provider.requestTemporaryCredentials,
      provider.requestAccessToken,
      provider.oauth_consumer_key,
      provider.client_secret,
      provider.version,
      provider.authorize_callback,
      provider.encryption
    );

    try {
      getAccessToken = thunkify( authenticator.getOAuthAccessToken.bind( authenticator ) );
      var callback = yield getAccessToken( 
        credentials.oauth_token,
        credentials.oauth_token_secret,
        credentials.oauth_verifier
      );

      credentials.oauth_access_token = callback[0];
      credentials.oauth_token_secret = callback[1];

    } catch ( e ) {
      winston.error( e );
    }

    return api;
  }
}