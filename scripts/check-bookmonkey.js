require("dotenv").config();
const { checkBookMonkeyHealth } = require("../src/services/bookMonkeyService");

(async () => {
  try {
    const result = await checkBookMonkeyHealth();
    console.log(`BookMonkey API OK: ${result.baseUrl} (books=${result.count})`);
  } catch (error) {
    console.error("BookMonkey API check failed:", error.message);
    process.exit(1);
  }
})();
