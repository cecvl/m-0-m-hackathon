const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const routes = require("./routes");
const { fail } = require("./utils/response");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use(routes);

app.use((req, res) => {
  return fail(res, "Route not found", 404);
});

module.exports = { app };
