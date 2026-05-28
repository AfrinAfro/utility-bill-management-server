const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;


// MIDDLEWARE


app.use(
  cors({
    origin: ["http://localhost:5174"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());


// VERIFY TOKEN


const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }

    req.decoded = decoded;
    next();
  });
};


// MONGODB


const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}` +
  `@cluster0.nrl0hct.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully");

    const billsCollection = client.db("utilityDB").collection("bills");
    const usersCollection = client.db("utilityDB").collection("users");
    const paymentsCollection = client.db("utilityDB").collection("payments");

  
    // JWT
    

    app.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // USERS
    
    app.post("/users", async (req, res) => {
      const user = req.body;

      const existing = await usersCollection.findOne({
        email: user.email,
      });

      if (existing) {
        return res.send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/role/:email", async (req, res) => {
      const user = await usersCollection.findOne({
        email: req.params.email,
      });

      res.send(user || { role: "user" });
    });

  
    // BILLS
    

    app.get("/bills", async (req, res) => {
      const limit = parseInt(req.query.limit);
      const category = req.query.category;

      let query = {};

      if (category && category !== "All") {
        query.bill_type = category;
      }

      let cursor = billsCollection.find(query);

      if (limit) {
        cursor = cursor.limit(limit);
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/bills/:id", async (req, res) => {
      const result = await billsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });

    app.post("/bills", async (req, res) => {
      const result = await billsCollection.insertOne(req.body);
      res.send(result);
    });

    app.put("/bills/:id", async (req, res) => {
      const result = await billsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );

      res.send(result);
    });

    app.delete("/bills/:id", async (req, res) => {
      const result = await billsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });

    
    // PAYMENTS
   

    app.post("/payments", async (req, res) => {
      const result = await paymentsCollection.insertOne(req.body);
      res.send(result);
    });

    // GET USER PAYMENTS (PROTECTED)
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await paymentsCollection
        .find({ userEmail: email })
        .toArray();

      res.send(result);
    });

    // UPDATE PAYMENT 
    app.put("/payments/:id", verifyToken, async (req, res) => {
      const result = await paymentsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );

      res.send(result);
    });

   
    app.delete("/payments/:id", verifyToken, async (req, res) => {
      const result = await paymentsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });
  } catch (error) {
    console.log(error);
  }
}

run();


// ROOT


app.get("/", (req, res) => {
  res.send("UtilityPay Pro Server Running");
});


// START SERVER


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});