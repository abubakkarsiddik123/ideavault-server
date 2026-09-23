const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
require("dotenv").config();
const port = process.env.PORT || 8080;
const uri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const JWKS = createRemoteJWKSet(new URL("http://localhost:3000/api/auth/jwks"));

const verifyToken = async (req, res, next) => {
  const authHeaders = req?.headers.authorization;

  if (!authHeaders) {
    return res.status(401).json({ message: "unauthorization" });
  }
  const token = authHeaders.split(" ")[1];
  // console.log(token, "token");
  if (!token) {
    return res.status(401).json({ message: "unauthorization" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    // console.log(payload, "payload");

    req.user = payload;

    next();
  } catch (error) {
    console.log(error);

    return res.status(403).json({
      message: "Forbidden",
    });
  }
};

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
    const commentsCollection = db.collection("comments");

    app.post("/idea", async (req, res) => {
      const data = req.body;
      const { title } = data;

      if (!title || !title.trim()) {
        return res.status(400).send({
          message: "Idea title is required",
        });
      }

      const result = await ideasCollection.insertOne(data);

      res.send(result);
    });
    app.get("/idea", async (req, res) => {
      const { search, category } = req.query;

      const query = {};

      if (search) {
        query.title = {
          $regex: search,
          $options: "i",
        };
      }
      if (category) {
        query.category = category;
      }

      const result = await ideasCollection.find(query).toArray();

      res.send(result);
    });

    app.get("/idea/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await ideasCollection.findOne(query);
      res.send(result);
    });

    app.get("/my-idea", verifyToken, async (req, res) => {
      const userId = req.user.sub;

      console.log("User ID:", userId);

      const result = await ideasCollection.find({ userId: userId }).toArray();

      res.json(result);
    });
    app.delete("/idea/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const userId = req.user.sub;

      const result = await ideasCollection.deleteOne({
        _id: new ObjectId(id),
        userId: userId,
      });

      res.send(result);
    });

    app.patch("/my-idea/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      const userId = req.user.sub;

      const updateData = req.body;

      const result = await ideasCollection.updateOne(
        {
          _id: new ObjectId(id),
          userId,
        },
        {
          $set: updateData,
        },
      );
      if (updateData.title) {
        await commentsCollection.updateMany(
          {
            ideaId: id,
          },
          {
            $set: {
              ideaTitle: updateData.title,
            },
          },
        );
      }

      res.send(result);
    });

    app.post("/comments", verifyToken, async (req, res) => {
      const { ideaId, comment } = req.body;

      const idea = await ideasCollection.findOne({
        _id: new ObjectId(ideaId),
      });

      const newComment = {
        ideaId,
        ideaTitle: idea.title,
        userId: req.user.sub,
        name: req.user.name,
        image: req.user.image,
        comment,
        createdAt: new Date(),
      };

      const result = await commentsCollection.insertOne(newComment);

      res.send(result);
    });
    app.get("/comments/:ideaId", async (req, res) => {
      const { ideaId } = req.params;

      const result = await commentsCollection
        .find({ ideaId })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    app.patch("/comments/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { comment } = req.body;
      const result = await commentsCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            comment: comment.trim(),
            updatedAt: new Date(),
          },
        },
      );

      res.send(result);
    });
    app.delete("/comments/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await commentsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    app.get("/my-comments", verifyToken, async (req, res) => {
      console.log("🔥 /my-comments route called");

      const userId = req.user.sub;

      console.log("User ID:", userId);

      const result = await commentsCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      console.log("My Comments:", result);

      res.send(result);
    });

    app.get("/trending-ideas", async (req, res) => {
      const result = await ideasCollection
        .find()
        .sort({ _id: 1 })
        .limit(6)
        .toArray();

      res.send(result);
    });

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
