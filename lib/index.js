const config = require('../config')
const debug = require('debug')('api:orbitdb')
const EventEmitter = require('events').EventEmitter
const helpers = require('./helpers')
const metadata = require('@dadi/metadata')
const util = require('util')
const uuid = require('uuid')

const IPFS = require('ipfs')
const OrbitDB = require('orbit-db')

// OrbitDB uses Pubsub which is an experimental feature
// and need to be turned on manually.
// Note that these options need to be passed to IPFS in
// all examples even if not specfied so.
const ipfsOptions = {
  EXPERIMENTAL: {
    pubsub: true
  }
}

// Create IPFS instance
const ipfs = new IPFS(ipfsOptions)
let orbitdb

ipfs.on('error', (e) => console.error(e))
// ipfs.on('ready', async () => {
//   orbitdb = new OrbitDB(ipfs)
// })

// // Create IPFS instance
// const ipfs = new IPFS(ipfsOptions)

// ipfs.on('error', (e) => console.error(e))
// ipfs.on('ready', async () => {
// //   // Create a database
// const orbitdb = new OrbitDB(ipfs)
//   const db = await orbitdb.docstore('dadi.api.empire.people')

//   db.events.on('load', (dbname) => {
//     console.log('Load', dbname)
//   })

//   db.events.on('load.progress', (address, hash, entry, progress, total) => {
//     console.log(`Loaded ${progress}/${total}`)
//   })

//   db.events.on('ready', (dbname) => {
//     console.log(`Ready: ${dbname}`)

//     console.log(`DB Address: ${db.address.toString()}`)

//     // Add an entry to the database
//     db.put({_id: uuid.v4(), name: 'Jim', age: 41}).then(async hash => {
//       const result = db.query(e => e.age > 20)
//       console.log(JSON.stringify(result, null, 2))
//     })

//     // })
//   })

//   db.load()
// })

const STATE_DISCONNECTED = 0
const STATE_CONNECTED = 1
const STATE_CONNECTING = 2

/**
 * @typedef ConnectionOptions
 * @type {Object}
 * @property {string} database - the name of the database file to use
 * @property {Object} collection - the name of the collection to use
 */

/**
 * @typedef QueryOptions
 * @type {Object}
 * @property {number} limit - the number of records to return
 * @property {number} skip - an offset, the number of records to skip
 * @property {Object} sort - an object specifying properties to sort by. `{"title": 1}` will sort the results by the `title` property in ascending order. To reverse the sort, use `-1`: `{"title": -1}`
 * @property {Object} fields - an object specifying which properties to return. `{"title": 1}` will return results with all properties removed except for `_id` and `title`
 */

/**
 * Handles the interaction with <Database>
 * @constructor DataStore
 * @classdesc DataStore adapter for using <Database> with DADI API
 * @implements EventEmitter
 */
const DataStore = function DataStore (options) {
  this.config = options || config.get()
  this.readyState = STATE_DISCONNECTED

  this.databases = {}
}

util.inherits(DataStore, EventEmitter)

/**
 * Connect to the database
 *
 * @param {ConnectionOptions} options
 */
DataStore.prototype.connect = function (options) {
  debug('connect %o', options)

  let apiDbName = `${config.get('database.name')}.${options.collection}`

  console.log(apiDbName)

  if (config.get('databases') && config.get('databases')[apiDbName]) {
    apiDbName = config.get('databases')[apiDbName]
  }

  return new Promise((resolve, reject) => {
    // problem connecting, emit 'DB_ERROR' event
    // this.emit('DB_ERROR', err)

    ipfs.on('ready', async () => {
      orbitdb = new OrbitDB(ipfs)

      orbitdb.docstore(apiDbName).then(db => {
        // console.log(db)
        db.events.on('load', (dbname) => {
          debug(`Database "${apiDbName}" load`)
        })

        db.events.on('load.progress', (address, hash, entry, progress, total) => {
          debug(`Database "${apiDbName}" loading ${progress}/${total}`)
        })

        db.events.on('replicated', address => {
          debug(`Database "${apiDbName}" replicated: ${address}`)
        })

        db.events.on('replicate.progress', (address, hash, entry, progress, have) => {
          debug(`Database "${apiDbName}" replicating: ${address}, ${hash}, ${entry}, ${progress}`)
        })

        db.events.on('ready', (dbname) => {
          debug(`Database "${apiDbName}" ready at ${dbname}`)

          this.databases[apiDbName] = db

          this.database = db

          // everything is ok, emit 'DB_CONNECTED' event
          this.readyState = STATE_CONNECTED
          this.emit('DB_CONNECTED', this.database)

          return resolve()
        })

        db.load()
      })
    })
  })
}

/**
 * Query the database
 *
 * @param {Object} query - the query to perform
 * @param {string} collection - the name of the collection to query
 * @param {QueryOptions} options - a set of query options, such as offset, limit, sort, fields
 * @param {Object} schema - the JSON schema for the collection
 * @returns {Promise.<Array, Error>} A promise that returns an Array of results,
 *     or an Error if the operation fails
 */
DataStore.prototype.find = function ({ query, collection, options = {}, schema, settings }) {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  options = options || {}

  debug('find in %s where %o %o', collection, query, options)

  let apiDbName = `${config.get('database.name')}.${collection}`
  let db = this.databases[apiDbName]

  console.log(apiDbName)

  return new Promise((resolve, reject) => {
    let results = db.query(document => {
      return helpers.includeDocumentInResult(document, query)
    })

    if (!results) {
      results = []
    }

    let returnData = {}
    returnData.results = results
    returnData.metadata = this.getMetadata(options, results.length)

    return resolve(returnData)
  })
}

/**
 * Insert documents into the database
 *
 * @param {Object|Array} data - a single document or an Array of documents to insert
 * @param {string} collection - the name of the collection to insert into
 * @param {object} options - options to modify the query
 * @param {Object} schema - the JSON schema for the collection
 * @returns {Promise.<Array, Error>} A promise that returns an Array of inserted documents,
 *     or an Error if the operation fails
 */
DataStore.prototype.insert = function ({data, collection, options = {}, schema, settings = {}}) {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  // make an Array of documents if an Object has been provided
  if (!Array.isArray(data)) {
    data = [data]
  }

  let apiDbName = `${config.get('database.name')}.${collection}`
  debug('insert into %s %s %o', apiDbName, collection, data)

  let db = this.databases[apiDbName]

  if (!db) {
    let orbitdb = new OrbitDB(ipfs)
    orbitdb.docstore(apiDbName).then(db => {
      this.databases[apiDbName] = db
    })
  }

  return new Promise((resolve, reject) => {
    let results = []

    data.forEach((document, idx) => {
      // add an _id if the document doesn't come with one
      document._id = document._id || uuid.v4()

      db.put(document).then(hash => {
        let newDocument = db.query(e => e._id === document._id)
        results.push(newDocument[0])

        if (idx === data.length - 1) {
          return resolve(results)
        }
      })
    })
  })
}

/**
 * Update documents in the database
 *
 * @param {object} query - the query that selects documents for update
 * @param {string} collection - the name of the collection to update documents in
 * @param {object} update - the update for the documents matching the query
 * @param {object} options - options to modify the query
 * @param {object} schema - the JSON schema for the collection
 * @returns {Promise.<Array, Error>} A promise that returns an Array of updated documents,
 *     or an Error if the operation fails
 */
DataStore.prototype.update = function ({query, collection, update, options = {}, schema}) {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  debug('update %s where %o with %o', collection, query, update)

  let apiDbName = `${config.get('database.name')}.${collection}`
  let db = this.databases[apiDbName]

  return new Promise((resolve, reject) => {
    let results = db.query(document => {
      return helpers.includeDocumentInResult(document, query)
    })

    console.log(results)

    let r = []

    results.forEach((document, idx) => {
      let updated = helpers.applyUpdatesToDocument(document, update)
      console.log(updated)
      db.put(updated).then(hash => {
        let newDocument = db.query(e => e._id === document._id)
        r.push(newDocument[0])

        if (idx === results.length - 1) {
          return resolve(r)
        }
      })
    })
  })
}

/**
 * Remove documents from the database
 *
 * @param {Object} query - the query that selects documents for deletion
 * @param {string} collection - the name of the collection to delete from
 * @param {Object} schema - the JSON schema for the collection
 * @returns {Promise.<Array, Error>} A promise that returns an Object with one property `deletedCount`,
 *     or an Error if the operation fails
 */
DataStore.prototype.delete = function ({query, collection, schema}) {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  debug('delete from %s where %o', collection, query)

  return new Promise((resolve, reject) => {
    return resolve({ deletedCount: 1 })
  })
}

/**
 *
 * @param {Object} options - the query options passed from API, such as page, limit, skip
 * @param {number} count - the number of results returned in the query
 * @returns {Object} an object containing the metadata for the query, such as totalPages, totalCount
 */
DataStore.prototype.getMetadata = function (options, count) {
  return metadata(options, count)
}

/**
 * Get metadata about the specfied collection, including number of records
 *
 * @param {Object} options - the query options passed from API, such as page, limit, skip
 * @returns {Object} an object containing the metadata about the collection
 */
DataStore.prototype.stats = function (collection, options) {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  return new Promise((resolve, reject) => {
    let result = {
      count: 100
    }

    return resolve(result)
  })
}

/**
 *
 */
DataStore.prototype.index = function (collection, indexes) {
  return new Promise((resolve, reject) => {
    // Create an index on the specified field(s)
    let results = []

    indexes.forEach((index, idx) => {
      results.push({
        collection: 'collection',
        index: 'indexName'
      })

      if (idx === indexes.length - 1) {
        return resolve(results)
      }
    })
  })
}

/**
 * Get an array of indexes
 *
 * @param {string} collectionName - the name of the collection to get indexes for
 * @returns {Array} - an array of index objects, each with a name property
 */
DataStore.prototype.getIndexes = function (collectionName) {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  return new Promise((resolve, reject) => {
    let indexes = [{
      name: 'index_1'
    }]

    return resolve(indexes)
  })
}

DataStore.prototype.dropDatabase = function (collectionName) {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  debug('dropDatabase %s', collectionName || '')

  return new Promise((resolve, reject) => {
    return resolve()
  })
}

module.exports = DataStore
