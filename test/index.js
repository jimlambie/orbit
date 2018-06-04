const ApiConnector = require('../lib')
const EventEmitter = require('events').EventEmitter
const exec = require('child_process').exec
const should = require('should')
const uuid = require('uuid')

const config = require(__dirname + '/../config')

const usersSchema = {
  name: {
    type: 'String'
  }
}

function cleanup (cb) {
  exec(`rm -rf ${config.get('repo')} ${config.get('store')}`, (err, result) => {
    cb()
  })
}

describe('ApiConnector', function () {
  this.timeout(15000)

  before(function (done) {
    cleanup(done)
  })

  beforeEach(function (done) {
    done()
  })

  afterEach(function (done) {
    // setTimeout(function () {
    // cleanup(done)
    // }, 1000)
    done()
  })

  after(function (done) {
    cleanup(done)
  })

  describe('constructor', function () {
    it('should be exposed', function (done) {
      ApiConnector.should.be.Function
      done()
    })

    it('should inherit from EventEmitter', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.should.be.an.instanceOf(EventEmitter)
      apiConnector.emit.should.be.Function
      done()
    })

    it.skip('should load config if no options supplied', function (done) {
      let apiConnector = new ApiConnector()
      should.exist(apiConnector.config)
      apiConnector.config.database.name.should.eql('my_database')
      done()
    })

    it('should load config from options supplied', function (done) {
      let apiConnector = new ApiConnector({ database: { name: 'my_big_database' } })
      should.exist(apiConnector.config)
      apiConnector.config.database.name.should.eql('my_big_database')
      done()
    })

    it('should have readyState == 0 when initialised', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.readyState.should.eql(0)
      done()
    })
  })

  describe('connect', function () {
    it('should create and return database when connecting', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content' }).then(() => {
        should.exist(apiConnector.database)
        done()
      })
    })

    it('should have readyState == 1 when connected', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'posts' }).then(() => {
        apiConnector.readyState.should.eql(1)
        done()
      })
    })
  })

  describe('insert', function () {
    it('should insert a single document into the database', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let user = { name: 'David' }

        apiConnector.insert({data: user, collection: 'users', options: {}, schema: usersSchema}).then(results => {
          results.should.be.an.instanceOf(Array)
          results[0].name.should.eql('David')
          done()
        }).catch(err => {
          console.log(err)
          done(err)
        })
      }).catch(err => {
        console.log(err)
        done(err)
      })
    })

    it('should insert an array of documents into the database', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'Ernest' }, { name: 'Wallace' }]

        apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
          results.should.be.an.instanceOf(Array)
          results.length.should.eql(2)
          results[0].name.should.eql('Ernest')
          results[1].name.should.eql('Wallace')
          done()
        })
      })
    })

    it('should add _id property if one isn\'t specified', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'Ernest' }]

        apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
          results.constructor.name.should.eql('Array')
          results.length.should.eql(1)
          results[0].name.should.eql('Ernest')
          should.exist(results[0]._id)
          done()
        })
      })
    })

    it('should use specified _id property if one is specified', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ _id: uuid.v4(), name: 'Ernest' }]

        apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
          results.constructor.name.should.eql('Array')
          results.length.should.eql(1)
          results[0].name.should.eql('Ernest')
          results[0]._id.should.eql(users[0]._id)
          done()
        })
      })
    })
  })

  describe('find', function () {
    it('should find a single document in the database', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'Wallace' }, { name: 'Ernest' }]

        apiConnector.dropDatabase().then(results => {
          apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
            apiConnector.find({query: { name: 'Wallace' }, collection: 'users', schema: {}}).then(results => {
              should.exist(results.results)
              results.results.should.be.an.instanceOf(Array)
              results.results[0].name.should.eql('Wallace')
              done()
            })
          })
        })
      })
    })

    it('should return the number of records requested when using `limit`', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'BigBird' }, { name: 'Ernie' }, { name: 'Oscar' }]

        apiConnector.dropDatabase().then(results => {
          apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
            apiConnector.find({query: {}, collection: 'users', options: { limit: 2 }, schema: usersSchema}).then(results => {
              should.exist(results.results)
              results.results.should.be.an.instanceOf(Array)
              results.results.length.should.eql(2)
              done()
            }).catch((err) => {
              done(err)
            })
          }).catch((err) => {
            done(err)
          })
        })
      })
    })

    it('should sort records in ascending order by the `_id` property when no query or sort are provided', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ _id: '0000000001', name: 'Ernie' }, { _id: '0000000003', name: 'Oscar' }, { _id: '0000000002', name: 'BigBird' }]

        apiConnector.dropDatabase().then(results => {
          apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
            apiConnector.find({query: {}, collection: 'users'}).then(results => {
              should.exist(results.results)
              results.results.should.be.an.instanceOf(Array)
              results.results.length.should.eql(3)

              results.results[0].name.should.eql('Ernie')
              results.results[1].name.should.eql('BigBird')
              results.results[2].name.should.eql('Oscar')
              done()
            }).catch((err) => {
              done(err)
            })
          }).catch((err) => {
            done(err)
          })
        })
      })
    })

    it('should sort records in ascending order by the query property when no sort is provided', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'BigBird 3' }, { name: 'BigBird 1' }, { name: 'BigBird 2' }]

        apiConnector.dropDatabase().then(results => {
          apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
            apiConnector.find({query: { name: { '$regex': 'Big' } }, collection: 'users'}).then(results => {
              console.log(results)
              should.exist(results.results)
              results.results.should.be.an.instanceOf(Array)
              results.results.length.should.eql(3)
              results.results[0].name.should.eql('BigBird 1')
              results.results[1].name.should.eql('BigBird 2')
              results.results[2].name.should.eql('BigBird 3')
              done()
            }).catch((err) => {
              done(err)
            })
          }).catch((err) => {
            done(err)
          })
        })
      })
    })

    it('should sort records in ascending order by the specified property', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'Ernie' }, { name: 'Oscar' }, { name: 'BigBird' }]

        apiConnector.dropDatabase().then(results => {
          apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
            apiConnector.find({query: {}, collection: 'users', options: { sort: { name: 1 } }}).then(results => {
              should.exist(results.results)
              results.results.should.be.an.instanceOf(Array)
              results.results.length.should.eql(3)
              results.results[0].name.should.eql('BigBird')
              results.results[1].name.should.eql('Ernie')
              results.results[2].name.should.eql('Oscar')
              done()
            }).catch((err) => {
              done(err)
            })
          }).catch((err) => {
            done(err)
          })
        })
      })
    })

    it('should sort records in descending order by the specified property', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'Ernie' }, { name: 'Oscar' }, { name: 'BigBird' }]

        apiConnector.dropDatabase().then(results => {
          apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
            apiConnector.find({query: {}, collection: 'users', options: { sort: { name: -1 } }}).then(results => {
              should.exist(results.results)
              results.results.should.be.an.instanceOf(Array)
              results.results.length.should.eql(3)
              results.results[0].name.should.eql('Oscar')
              results.results[1].name.should.eql('Ernie')
              results.results[2].name.should.eql('BigBird')
              done()
            }).catch((err) => {
              done(err)
            })
          }).catch((err) => {
            done(err)
          })
        })
      })
    })

    it('should return only the fields specified by the `fields` property', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'Ernie', age: 7, colour: 'yellow' }, { name: 'Oscar', age: 9, colour: 'green' }, { name: 'BigBird', age: 13, colour: 'yellow' }]

        apiConnector.dropDatabase().then(results => {
          apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
            apiConnector.find({query: { colour: 'yellow' }, collection: 'users', options: { sort: { name: 1 }, fields: { name: 1, age: 1 } }}).then(results => {
              should.exist(results.results)
              results.results.should.be.an.instanceOf(Array)
              results.results.length.should.eql(2)

              let bigBird = results.results[0]
              should.exist(bigBird.name)
              should.exist(bigBird.age)
              should.exist(bigBird._id)
              should.not.exist(bigBird.colour)
              done()
            }).catch((err) => {
              done(err)
            })
          }).catch((err) => {
            done(err)
          })
        })
      })
    })
  })

  describe('update', function () {
    describe('$set', function () {
      it('should update documents matching the query', function (done) {
        let apiConnector = new ApiConnector()
        apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
          let users = [{ name: 'Ernie', age: 7, colour: 'yellow' }, { name: 'Oscar', age: 9, colour: 'green' }, { name: 'BigBird', age: 13, colour: 'yellow' }]

          apiConnector.dropDatabase().then(results => {
            apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
              apiConnector.update({ query: { colour: 'green' }, collection: 'users', update: { '$set': { colour: 'yellow' } }}).then(results => {
                apiConnector.find({ query: { colour: 'yellow' }, collection: 'users', options: {}, schema: usersSchema }).then(results => {
                  should.exist(results.results)
                  results.results.should.be.an.instanceOf(Array)
                  results.results.length.should.eql(3)
                  done()
                }).catch((err) => {
                  done(err)
                })
              }).catch((err) => {
                done(err)
              })
            }).catch((err) => {
              done(err)
            })
          })
        })
      })
    })

    describe('$inc', function () {
      it('should update documents matching the query', function (done) {
        let apiConnector = new ApiConnector()
        apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
          let users = [{ name: 'Ernie', age: 7, colour: 'yellow' }, { name: 'Oscar', age: 9, colour: 'green' }, { name: 'BigBird', age: 13, colour: 'yellow' }]

          apiConnector.dropDatabase().then(results => {
            apiConnector.insert({data: users, collection: 'users', options: {}, schema: usersSchema}).then(results => {
              apiConnector.update({ query: { colour: 'green' }, collection: 'users', update: { '$inc': { age: 10 } } }).then(results => {
                apiConnector.find({ query: { colour: 'green' }, collection: 'users', options: {}, schema: usersSchema }).then(results => {
                  should.exist(results.results)
                  results.results.should.be.an.instanceOf(Array)
                  results.results.length.should.eql(1)
                  results.results[0].age.should.eql(19)
                  done()
                }).catch((err) => {
                  done(err)
                })
              }).catch((err) => {
                done(err)
              })
            }).catch((err) => {
              done(err)
            })
          })
        })
      })
    })
  })

  describe('delete', function () {
    it('should delete documents matching the query', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let users = [{ name: 'Ernie', age: 7, colour: 'yellow' }, { name: 'Oscar', age: 9, colour: 'green' }, { name: 'BigBird', age: 13, colour: 'yellow' }]

        apiConnector.dropDatabase().then(results => {
          apiConnector.insert({ data: users, collection: 'users', options: {}, schema: usersSchema }).then(results => {
            apiConnector.delete({ query: { colour: 'green' }, collection: 'users' }).then(results => {
              apiConnector.find({ query: {}, collection: 'users', options: {}, schema: usersSchema }).then(results => {
                should.exist(results.results)
                results.results.should.be.an.instanceOf(Array)
                results.results.length.should.eql(2)
                done()
              }).catch((err) => {
                done(err)
              })
            }).catch((err) => {
              done(err)
            })
          }).catch((err) => {
            done(err)
          })
        })
      })
    })
  })

  describe.skip('database', function () {
    it('should contain all collections that have been inserted into', function (done) {
      let apiConnector = new ApiConnector()
      apiConnector.connect({ database: 'content', collection: 'users' }).then(() => {
        let user = { name: 'David' }

        apiConnector.insert({data: user, collection: 'users', options: {}, schema: usersSchema}).then(results => {
          results.constructor.name.should.eql('Array')
          results[0].name.should.eql('David')

          apiConnector.connect({ database: 'content', collection: 'posts' }).then(() => {
            let post = { title: 'David on Holiday' }

            apiConnector.insert({data: post, collection: 'posts', options: {}, schema: usersSchema}).then(results => {
              results.constructor.name.should.eql('Array')
              results[0].title.should.eql('David on Holiday')

              let u = apiConnector.database.getCollection('users')
              let p = apiConnector.database.getCollection('posts')
              should.exist(u)
              should.exist(p)
              done()
            }).catch((err) => {
              done(err)
            })
          }).catch((err) => {
            done(err)
          })
        })
      })
    })

    it('should handle connection to multiple databases', function (done) {
      let contentStore = new ApiConnector()
      let authStore = new ApiConnector()

      contentStore.connect({ database: 'content' }).then(() => {
        authStore.connect({ database: 'auth' }).then(() => {
          contentStore.insert({data: { name: 'Jim' }, collection: 'users', options: {}, schema: usersSchema}).then(results => {
            authStore.insert({data: { token: '123456123456123456123456' }, collection: 'token-store', options: {}, schema: usersSchema}).then(results => {
              contentStore.find({ name: 'Jim' }, 'users', {}).then(results => {
                results.constructor.name.should.eql('Array')
                results[0].name.should.eql('Jim')

                authStore.find({ token: '123456123456123456123456' }, 'token-store', {}).then(results => {
                  results.constructor.name.should.eql('Array')
                  results[0].token.should.eql('123456123456123456123456')
                  done()
                })
              })
            })
          })
        })
      })
    })
  })
})
