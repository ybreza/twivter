// Generates the bcrypt hashes used by scripts/seed.mjs.
const bcrypt = require('bcryptjs')

const password = process.argv[2] ?? 'password123'
const hash = bcrypt.hashSync(password, 10)
console.log(hash)

// Verify it round-trips so a typo in the seed cannot ship silently.
if (!bcrypt.compareSync(password, hash)) {
  console.error('HASH VERIFICATION FAILED')
  process.exit(1)
}
console.error(`verified: "${password}" matches the hash above`)