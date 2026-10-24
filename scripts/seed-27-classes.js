/**
 * scripts/seed-27-classes.js
 * Wrapper to run src/config/seed-classes.js
 */

const seedClasses = require('../src/config/seed-classes');

if (require.main === module) {
  seedClasses();
}

module.exports = seedClasses;
