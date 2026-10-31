const path = require('path');

/** Local working/output directory for transcoded media (served at /media). */
const TEMP_BASE = path.join(__dirname, '../../temp');

module.exports = { TEMP_BASE };
