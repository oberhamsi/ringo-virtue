/**
 * @fileoverview
 * This bootstraps the web framework.
 */
var {Store, ConnectionPool, Cache} = require("ringo-sqlstore");
var {Environment} = require('reinhardt');
var {Application} = require('stick');
var {Server}  = require('ringo/httpserver');
var system = require('system');

if (system.args.length < 2) {
  print ('Requires the path to the config.js file as argument.');
  system.exit(1);
}
var configFile = system.args[1];

// config and logging
// @@ merge configs depending on: debug? winlinmac?
var config = exports.config = require('gestalt').load(configFile);
var log = exports.log = require("ringo/logging").getLogger(module.id);

// @@ verify all necessary config settings are present

// Create database caches
if (config.get('db')) {
  var entityCache = module.singleton("entityCache", function() {
      return new Cache(config.get('db').cacheSize);
  });
  var queryCache = module.singleton("queryCache", function() {
      return new Cache(config.get('db').cacheSize);
  });
  var connectionPool = module.singleton('connectionpool', function() {
     return new ConnectionPool(config.get('db'));
  });

  // Create database connection and set caches
  var db = exports.db = new Store(connectionPool);
  db.setEntityCache(entityCache);
  db.setQueryCache(queryCache);
} else {
  log.info('No database configured.');
}
// Root stick application
var rootApp = exports.rootApp = new Application();
rootApp.configure("etag", "requestlog", "notfound", "session", "params", "mount");
if (config.get('debug') === true) {
   rootApp.configure(require('reinhardt/middleware'));
   rootApp.configure("error");
}

if (config.get('templates')) {
  // Create templating environment
  exports.templates = new Environment(config.get('templates'));
} else {
  log.info('No templates configured.');
}

// Accessing this property creates a
// new stick application with the `route`
// middleware preconfigured. This is convinient
// for views.js
Object.defineProperty(exports, 'app', {
   get: function() {
      var app = Application();
      app.configure("route");
      return app;
   }
});

if (config.get('server')) {
  rootApp.mount(config.get('server').baseUri, config.get('server').views);

  var httpServer = module.singleton('httpServer', function() {
      var httpServer = new Server({
       appModule: module.id,
       appName: 'rootApp',
       port: config.get('server').port
     });

      var staticContext = httpServer.getContext(config.get('server').staticMountpoint);
      staticContext.serveStatic(config.get('server').staticDir);
      return httpServer;
  });
} else {
  log.info('No server configured.')
}

var start = exports.start = function() {
   if (httpServer) {
     httpServer.start();
   }
}

var stop = exports.stop = function() {
  if (httpServer) {
    httpServer.stop();
  }
}

if (require.main == module.id) {
  start();
  require('ringo/engine').addShutdownHook(stop);
}