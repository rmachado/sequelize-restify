'use strict';

var request = require('request'),
    async = require('async'),
    expect = require('chai').expect,
    _ = require('lodash'),
    rest = require('../../lib'),
    test = require('../support');

describe('Resource(basic)', function() {
  before(function() {
    test.models.User = test.db.define('users', {
      id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      username: {
        type: test.Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: test.Sequelize.STRING,
        unique: { msg: 'must be unique' },
        validate: { isEmail: true }
      }
    }, {
      underscored: true,
      timestamps: false
    });

    test.models.Person = test.db.define('person', {
      id: { type: test.Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      firstname: { type: test.Sequelize.STRING },
      lastname: { type: test.Sequelize.STRING }
    }, {
      underscored: true,
      timestamps: false
    });
  });

  beforeEach(function(done) {
    test.initializeDatabase(function() {
      test.initializeServer(function() {
        rest.initialize({
          app: test.app,
          sequelize: test.Sequelize
        });

        rest.resource({
          model: test.models.User,
          endpoints: ['/users', '/users/:id']
        });

        done();
      });
    });
  });

  afterEach(function(done) {
    test.clearDatabase(function() {
      test.server.close(done);
    });
  });

  // TESTS
  describe('construction', function() {
    it('should throw an exception if called with an invalid model', function(done) {
      expect(rest.resource).to.throw('please specify a valid model');
      done();
    });

    it('should throw an exception if created with an invalid model', function(done) {
      try {
        var resource = new rest.Resource();
      } catch (exception) {
        expect(exception).to.eql(new Error('resource needs a model'));
      }

      done();
    });

    it('should auto generate endpoints if none were provided', function() {
      var resource = rest.resource({
        model: test.models.Person
      });

      expect(resource.endpoints).to.eql({ plural: '/people', singular: '/people/:id' });
    });
  });

  describe('create', function() {
    it('should create a record', function(done) {
      request.post({
        url: test.baseUrl + '/users',
        json: { username: 'arthur', email: 'arthur@gmail.com' }
      }, function(error, response, body) {
        expect(response.statusCode).to.equal(201);
        expect(response.headers.location).to.match(/\/users\/\d+/);
        done();
      });
    });


    [
      {
        description: 'should catch validation errors',
        record: { username: 'blah', email: 'notanemail' },
        expected: {
          statusCode: 400,
          fields: ['email']
        }
      },
      {
        description: 'should catch null field errors',
        record: { email: 'valid@email.com' },
        expected: {
          statusCode: 400,
          fields: ['username']
        }
      }
    ].forEach(function(createTest) {
      it(createTest.description, function(done) {
        request.post({
          url: test.baseUrl + '/users',
          json: createTest.record
        }, function(error, response, body) {
          var result = _.isObject(body) ? body : JSON.parse(body);
          expect(response.statusCode).to.equal(createTest.expected.statusCode);
          expect(result).to.contain.keys(['message', 'errors']);
          createTest.expected.fields.forEach(function(field, i) {
            expect(result.errors[i].field).to.equal(field);
          });

          done();
        });
      });
    });

    it('should catch uniqueness errors', function(done) {
      var record = { username: 'jamez', email: 'jamez@gmail.com' };
      request.post({
        url: test.baseUrl + '/users',
        json: record
      }, function(error, response, body) {
        expect(error).is.null;
        expect(response.headers.location).is.not.empty;

        var path = response.headers.location;
        request.post({
          url: test.baseUrl + '/users',
          json: record
        }, function(err, response, body) {
          expect(response.statusCode).to.equal(400);
          var record = _.isObject(body) ? body : JSON.parse(body);
          expect(record).to.contain.keys(['message', 'errors']);
          expect(record.errors[0].field).to.equal('email');
          done();
        });
      });
    });

  });

  describe('read', function() {
    it('should return proper error for an invalid record', function(done) {
      request.get({ url: test.baseUrl + '/users/42' }, function(err, response, body) {
        expect(response.statusCode).to.equal(404);
        var record = _.isObject(body) ? body : JSON.parse(body);
        expect(record).to.contain.keys('message');
        done();
      });
    });

    it('should read a record', function(done) {
      var userData = { username: 'jamez', email: 'jamez@gmail.com' };
      request.post({
        url: test.baseUrl + '/users',
        json: userData
      }, function(error, response, body) {
        expect(error).is.null;
        expect(response.headers.location).is.not.empty;

        var path = response.headers.location;
        request.get({ url: test.baseUrl + path }, function(err, response, body) {
          expect(response.statusCode).to.equal(200);
          var record = _.isObject(body) ? body : JSON.parse(body);

          delete record.id;
          expect(record).to.eql(userData);
          done();
        });
      });
    });
  });

  describe('update', function() {
    it('should return 404 for invalid record', function(done) {
      request.put({ url: test.baseUrl + '/users/42' }, function(err, response, body) {
        expect(response.statusCode).to.equal(404);
        var record = _.isObject(body) ? body : JSON.parse(body);
        expect(record).to.contain.keys('error');
        done();
      });
    });

    it('should update a record', function(done) {
      var userData = { username: 'jamez', email: 'jamez@gmail.com' };
      request.post({
        url: test.baseUrl + '/users',
        json: userData
      }, function(error, response, body) {
        expect(error).is.null;
        expect(response.headers.location).is.not.empty;

        var path = response.headers.location;
        request.put({
          url: test.baseUrl + path,
          json: { email: 'emma@fmail.co.uk' }
        }, function(err, response, body) {
          expect(response.statusCode).to.equal(200);
          var record = _.isObject(body) ? body : JSON.parse(body);

          delete record.id;
          userData.email = 'emma@fmail.co.uk';
          expect(record).to.eql(userData);
          done();
        });
      });
    });
  });

  describe('delete', function() {
    it('should return proper error for invalid record', function(done) {
      request.del({ url: test.baseUrl + '/users/42' }, function(err, response, body) {
        expect(response.statusCode).to.equal(404);
        var record = _.isObject(body) ? body : JSON.parse(body);
        expect(record).to.contain.keys('message');
        done();
      });
    });

    it('should delete a record', function(done) {
      var userData = { username: 'chicken', email: 'chicken@gmail.com' };
      request.post({
        url: test.baseUrl + '/users',
        json: userData
      }, function(error, response, body) {
        expect(error).is.null;
        expect(response.headers.location).is.not.empty;

        var path = response.headers.location;
        request.del({ url: test.baseUrl + path }, function(err, response, body) {
          expect(response.statusCode).to.equal(200);

          request.get({ url: test.baseUrl + path }, function(err, response, body) {
            expect(response.statusCode).is.equal(404);
            done();
          });
        });
      });
    });
  });

  describe('list', function() {
    beforeEach(function(done) {
      test.userlist = [
        { username: 'arthur', email: 'arthur@gmail.com' },
        { username: 'james', email: 'james@gmail.com' },
        { username: 'henry', email: 'henry@gmail.com' },
        { username: 'william', email: 'william@gmail.com' },
        { username: 'edward', email: 'edward@gmail.com' },
        { username: 'arthur', email: 'aaaaarthur@gmail.com' }
      ];

      async.each(test.userlist, function(data, callback) {
        request.post({
          url: test.baseUrl + '/users',
          json: data
        }, function(error, response, body) {
          expect(response).to.not.be.null;
          expect(response.statusCode).to.equal(201);
          expect(response.headers.location).to.match(/\/users\/\d+/);
          callback();
        });
      }, done);
    });

    afterEach(function() {
      delete test.userlist;
    });

    it('should list all records', function(done) {
      request.get({ url: test.baseUrl + '/users' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql(test.userlist);
        expect(response.headers['content-range']).to.equal('items 0-5/6');
        done();
      });
    });

    it('should list all records matching a field name and value', function(done) {
      request.get({ url: test.baseUrl + '/users?username=henry' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql([{ username: 'henry', email: 'henry@gmail.com' }]);
        expect(response.headers['content-range']).to.equal('items 0-0/1');
        done();
      });
    });

    it('should list some records using offset and count', function(done) {
      request.get({ url: test.baseUrl + '/users?offset=1&count=2' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql(test.userlist.slice(1, 3));
        expect(response.headers['content-range']).to.equal('items 1-2/6');
        done();
      });
    });

    it('should support a generic query string', function(done) {
      request.get({ url: test.baseUrl + '/users?q=ll' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(response.headers['content-range']).to.equal('items 0-0/1');
        expect(records).to.eql([{ username: 'william', email: 'william@gmail.com' }]);
        done();
      });
    });

    it('should support a generic query string as well as other criteria', function(done) {
      request.get({ url: test.baseUrl + '/users?q=gmail&offset=1&count=2' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(response.headers['content-range']).to.equal('items 1-2/6');
        expect(records).to.eql([{ username: 'james', email: 'james@gmail.com' },
                                { username: 'henry', email: 'henry@gmail.com' }]);
        done();
      });
    });

    it('should return a valid content-range with no results for a query', function(done) {
      request.get({ url: test.baseUrl + '/users?q=zzzz' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql([]);
        expect(response.headers['content-range']).to.equal('items 0-0/0');
        done();
      });
    });

    it('should sort by a single field ascending', function(done) {
      request.get({ url: test.baseUrl + '/users?sort=username' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql([
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'arthur', email: 'aaaaarthur@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' },
          { username: 'henry', email: 'henry@gmail.com' },
          { username: 'james', email: 'james@gmail.com' },
          { username: 'william', email: 'william@gmail.com' }
        ]);
        done();
      });
    });

    it('should sort by a single field descending', function(done) {
      request.get({ url: test.baseUrl + '/users?sort=-username' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql([
          { username: 'william', email: 'william@gmail.com' },
          { username: 'james', email: 'james@gmail.com' },
          { username: 'henry', email: 'henry@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' },
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'arthur', email: 'aaaaarthur@gmail.com' }
        ]);
        done();
      });
    });

    it('should sort by multiple fields', function(done) {
      request.get({ url: test.baseUrl + '/users?sort=username,email' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql([
          { username: 'arthur', email: 'aaaaarthur@gmail.com' },
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' },
          { username: 'henry', email: 'henry@gmail.com' },
          { username: 'james', email: 'james@gmail.com' },
          { username: 'william', email: 'william@gmail.com' }
        ]);
        done();
      });
    });

    it('should sort by multiple fields ascending/descending', function(done) {
      request.get({ url: test.baseUrl + '/users?sort=username,-email' }, function(err, response, body) {
        expect(response.statusCode).to.equal(200);
        var records = JSON.parse(body).map(function(r) { delete r.id; return r; });
        expect(records).to.eql([
          { username: 'arthur', email: 'arthur@gmail.com' },
          { username: 'arthur', email: 'aaaaarthur@gmail.com' },
          { username: 'edward', email: 'edward@gmail.com' },
          { username: 'henry', email: 'henry@gmail.com' },
          { username: 'james', email: 'james@gmail.com' },
          { username: 'william', email: 'william@gmail.com' }
        ]);
        done();
      });
    });

    it('should fail with invalid sort criteria', function(done) {
      request.get({ url: test.baseUrl + '/users?sort=dogs' }, function(err, response, body) {
        expect(response.statusCode).to.equal(500);
        done();
      });
    });

  });

});
