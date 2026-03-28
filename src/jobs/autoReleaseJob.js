const { autoReleaseEligibleOrders } = require("../services/escrowService");

function startAutoReleaseJob() {
  const intervalMs = 60 * 1000;

  const timer = setInterval(() => {
    const released = autoReleaseEligibleOrders();
    if (released.length > 0) {
      console.log(`[auto-release] Released orders: ${released.join(", ")}`);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

module.exports = { startAutoReleaseJob };
