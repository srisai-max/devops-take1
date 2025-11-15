// server.js
const express = require("express");
const app = express();
const mongoClient = require("mongodb").MongoClient;
require("dotenv").config();
const cors = require("cors");

// -------------------------
//  PROMETHEUS METRICS
// -------------------------
const clientpm = require("prom-client");
const register = new clientpm.Registry();

// Collect default CPU, memory, event loop metrics
clientpm.collectDefaultMetrics({ register });

// Custom request counter metric
const httpRequestCounter = new clientpm.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests received",
});
register.registerMetric(httpRequestCounter);

// Count all requests
app.use((req, res, next) => {
  httpRequestCounter.inc();
  next();
});

// -------------------------
//  MIDDLEWARE
// -------------------------
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// -------------------------
//  METRICS ENDPOINT
// -------------------------
app.get("/metrics", async (req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.send(await register.metrics());
});

// -------------------------
//  ROUTES
// -------------------------
app.get("/", (req, res) => {
  return res.json({ message: "Hello from express" });
});

// Import user APIs
const userapp = require("./APIs/user-api");
app.use("/user-api", userapp);

// -------------------------
//  MONGODB CONNECTION
// -------------------------
let client;

mongoClient
  .connect(process.env.DB_URL)
  .then((mongoClientInstance) => {
    client = mongoClientInstance;

    const dbObj = client.db("budgetdb");
    const userscollection = dbObj.collection("usersBTcollection");
    const purchasehistory = dbObj.collection("purchasehistorycollection");

    app.set("userscollection", userscollection);
    app.set("purchasehistory", purchasehistory);

    console.log("Connected to MongoDB successfully");
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// -------------------------
//  ERROR HANDLER
// -------------------------
app.use((err, req, res, next) => {
  res.status(500).send({ message: "error", payload: err.message });
});

// -------------------------
//  START SERVER
// -------------------------
const port = process.env.PORT || 4000;

let server;
if (process.env.NODE_ENV !== "test") {
  server = app.listen(port, () =>
    console.log(`Server running on port ${port}`)
  );
}

module.exports = { app, client, server };
