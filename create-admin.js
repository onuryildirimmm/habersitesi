const bcrypt = require("bcryptjs");

const password = "123456"; // şimdilik
const hash = bcrypt.hashSync(password, 10);

console.log("PASSWORD:", password);
console.log("HASH:", hash);
