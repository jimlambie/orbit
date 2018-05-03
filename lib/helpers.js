module.exports = {
  // for each document, apply operator functions
  // generated from a MongoDB-style query
  includeDocumentInResult: includeDocumentInResult,
  applyUpdatesToDocument: applyUpdatesToDocument
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
      var re = new RegExp(query[key])
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
 *      name: 'Book 4 - Fourth Edition',
 *      _apiVersion: 'vjoin',
 *      _lastModifiedBy: 'store',
 *      _lastModifiedAt: 1525332677378
 *    },
 *    '$inc': {
 *      _version: 1
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
