const { app } = require("./app");
const { env } = require("./config/env");
const { startAutoReleaseJob } = require("./jobs/autoReleaseJob");

const stopAutoRelease = startAutoReleaseJob();

const server = app.listen(env.port, () => {
  console.log(`Backend prototype listening on port ${env.port}`);
});

function shutdown() {
  stopAutoRelease();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
