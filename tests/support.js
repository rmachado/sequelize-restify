'use strict';

var Sequelize = require('sequelize'),
    http = require('http'),
    express = require('express'),
    restify = require('restify'),
    chai = require('chai');

var TestFixture = {
  models: {},
  Sequelize: Sequelize,

  initializeDatabase: function(callback) {
    TestFixture.db
      .sync({ force: true })
      .then(function() {
        callback();
      });
  },

  initializeServer: function(callback) {
    if (process.env.USE_RESTIFY) {
      TestFixture.server = TestFixture.app = restify.createServer();
      TestFixture.server.use(restify.queryParser());
      TestFixture.server.use(restify.bodyParser());
    } else {
      TestFixture.app = express();
      TestFixture.app.use(express.json());
      TestFixture.app.use(express.urlencoded());
      TestFixture.server = http.createServer(TestFixture.app);
    }

    TestFixture.server.listen(0, function() {
      TestFixture.baseUrl =
        'http://' + TestFixture.server.address().address + ':' + TestFixture.server.address().port;
      callback();
    });
  },

  clearDatabase: function(callback) {
    TestFixture.db
      .getQueryInterface()
      .dropAllTables()
      .then(function() {
        callback();
      });
  }
};

before(function() {
  TestFixture.db = new Sequelize('main', null, null, {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  });
});

// always print stack traces when an error occurs
chai.config.includeStack = true;

module.exports = TestFixture;
