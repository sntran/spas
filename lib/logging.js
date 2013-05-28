/*
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
		input - Adds all requests and parameters
*/

var 
	  winston = require('winston')
	, nconf = require('./config').nconf
	, config = require('./config').config
;


var loggingLevels = {
	levels: { input: 0, verbose: 1, debug: 2, info: 3, event: 4, warn: 5, error: 6 },
	colors: { input: 'cyan', verbose: 'blue', debug: 'grey', info: 'green', event: 'white', warn: 'yellow', error: 'red' }
};
  
/*
	Configure Winston logging
*/

var logger = new (winston.Logger)({
  levels: loggingLevels.levels,
  colors: loggingLevels.colors,
  transports: [
    new (winston.transports.Console)({
      timestamp: true,
      colorize: true,
      level: typeof nconf.get('log') === 'undefined' ? 'event' : nconf.get('log'),
      handleExceptions: nconf.get('service') === true ? true : false,
    })
  ]
});

exports.winston = logger;