// ============================================================
// Config — combined runtime env + filesystem paths
// ============================================================

const env = require('./env');
const paths = require('./paths');

module.exports = { ...env, ...paths };
