const env = process.env.ENV || ''
const testEnv = process.env.TEST_ENV ? process.env.TEST_ENV === 'true' : false
const sentCodeTimeout = process.env.SENT_CODE_TIMEOUT ? Number(process.env.SENT_CODE_TIMEOUT) : 20000
const merge = process.env.MERGE ? process.env.MERGE === 'true' : true

let baseUrl
let specFile

switch (env) {
  case 'local':
    // local
    baseUrl = 'http://localhost:8080'
    specFile = '../swagger.yaml'
    break
  default:
    // custom
    baseUrl = process.env.BASE_URL || ''
    specFile = process.env.SPEC_FILE || ''

    if (baseUrl === '' || specFile === '') {
      console.error('Please set BASE_URL and SPEC_FILE env variables')
      process.exit()
    }
}

if (!testEnv) {
  console.error('Please set TEST_ENV to true for start testing')
  process.exit()
}

const config = {
  env: env,
  testEnv: testEnv,
  baseUrl: baseUrl,
  specFile: specFile,
  sentCodeTimeout: sentCodeTimeout,
  merge: merge
}

console.log('Settings: ', config)

module.exports = config
