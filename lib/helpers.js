module.exports = {
  includeDocumentInResult: includeDocumentInResult,
  applyUpdatesToDocument: applyUpdatesToDocument,
  getFields: getFields,
  getSortParameters: getSortParameters
}

const operations = {
  '$eq': function (a, b) {
    return a === b
  },
  '$ne': function (a, b) {
    return a === b
  },
  '$in': function (a, b) {
    return a.includes(b)
  },
  '$containsAny': function (a, b) {
    return a.includes(b)
  },
  '$gte': function (a, b) {
    return a >= b
  },
  '$set': function (document, value) {
    return Object.assign(document, value)
  },
  '$inc': function (document, value) {
    Object.keys(value).forEach(key => {
      document[key] += value[key]
    })

    return document
  },
  '$push': function (document, value) {
    Object.keys(value).forEach(key => {
      document[key] = document[key] || []
      document[key].push(value[key])
    })

    return document
  },
  '$regex': function (value, regex) {
    let re = new RegExp(regex)
    return re.test(value)
  }
}

function includeDocumentInResult (document, query) {
  let match = false
  let keys = Object.keys(query)

  if (keys.length === 0) {
    return true
  }

  keys.forEach(key => {
    if (Object.prototype.toString.call(query[key]) === '[object RegExp]') {
      let re = new RegExp(query[key])
      match = re.test(document[key])
    } else if (typeof query[key] === 'object') {
      // process operator function - if no operator it's considered $eq
      let operator = Object.keys(query[key])[0]
      match = operations[operator](document[key], query[key][operator])
    } else {
      match = operations['$eq'](document[key], query[key])
    }
  })

  return match
}

/**
 *  {
 *    '$set': {
 *      name: 'Book Name - Fourth Edition',
 *      _apiVersion: '1.0',
 *      _lastModifiedBy: 'api-client',
 *      _lastModifiedAt: 1525332677378
 *    },
 *    '$inc': {
 *      _version: 1
 *    },
 *    '$push': {
 *      _history: 'fc764fda-c5a1-4e6f-91ec-02efbefd19ae'
 *    }
 *  }
 *
 * @param {param type} name - description
 */
function applyUpdatesToDocument (document, update) {
  let operators = Object.keys(update)

  operators.forEach(operator => {
    document = operations[operator](document, update[operator])
  })

  return document
}

/**
 * Determines the list of properties to select from each document before returning. If an array is specified
 * it is returned. If an object is specified an array is created containing all the keys that have a value equal to 1.
 * The `_id` property is added if not already specified.
 *
 * @param {Array|Object} fields - an array of field names or an object such as `{"title": 1}`
 * @returns {Array} an array of property names to be selected from each document
 */
function getFields (fields) {
  let preparedFields

  if (!Array.isArray(fields)) {
    preparedFields = Object.keys(fields).filter((field) => { return fields[field] === 1 })
  } else {
    preparedFields = fields
  }

  if (!preparedFields['_id']) preparedFields.push('_id')

  return preparedFields
}

function getSortParameters (options, query) {
  let sort = {
    property: '_id',
    descending: false
  }

  if (options.sort) {
    sort.property = Object.keys(options.sort)[0]
    sort.descending = options.sort[sort.property] === -1
  } else if (Object.keys(query).length) {
    sort.property = Object.keys(query)[0]
  }

  return sort
}
