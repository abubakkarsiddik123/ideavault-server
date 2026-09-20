const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 8080;
const uri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

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

    const db = client.db("ideavaultDB");
    const ideasCollection = db.collection("ideas");

    app.get("/idea", async (req, res) => {
      const result = await ideasCollection.find().toArray();
      res.send(result);
    });

    app.get("/idea/:id",async(req, res)=>{
      const {id} = req.params
      const query = {
        _id:new ObjectId(id)
      } 
      const result = await ideasCollection.findOne(query)
      res.send(result)
    })


    app.post("/idea" , async (req, res)=>{
      const data = req.body
      const result = await ideasCollection.insertOne(data)
      res.send(result);
    })


    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
