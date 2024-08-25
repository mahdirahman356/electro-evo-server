
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5173',
  "https://electroevo-89e11.firebaseapp.com",
  "https://electroevo-89e11.web.app"
  ],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rz0kihv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const verifyToken = (req, res, next) => {
      const token = req?.cookies?.token
      if(!token){
        return res.status(401).send({message : "unauthorise access"})
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if(err){
            return res.status(401).send({message : "unauthorise access"})
          }
          req.user = decoded
          next()
      })

    }
    

    const database = client.db("queriesDB");
    const queriesCollection = database.collection("queries");
    const recommendCollection = database.collection("recommend");

    // jsonwebtoken
    app.post("/jwt", (req, res) => {
      const user = req.body
      let token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none"
      })
        .send({ success: true })
    })

    app.post('/signout', (req, res) => {
      res.clearCookie('token', { maxAge: 0 })
        .send({ success: true })
    })

    // queries
    app.get("/queries", async (req, res) => {
      const search = req.query.search;
      let query = {};
      if (search) {
        query.$or =[ 
          { productName: { $regex: search, $options: 'i' } }
        ]
      }

      const options = {};

      const result = await queriesCollection.find(query, options).toArray();
      res.send(result);
    })

    

    app.get("/queries/email/:email",verifyToken, async (req, res) => {
      if(req.user.email !== req.params.email){
        return res.status(403).send({message : "forbidden access"})
      }
      query = { email: req.params.email }
      const result = await queriesCollection.find(query).toArray()
      res.send(result)
    })

    app.get("/queries/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await queriesCollection.findOne(query)
      res.send(result)
    })

    app.post("/queries", async (req, res) => {
      const queries = req.body
      const result = await queriesCollection.insertOne(queries)
      res.send(result)
    })

    app.put("/queries/:id", async (req, res) => {
      const id = req.params.id
      const queries = req.body
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          productName: queries.productName,
          productBrand: queries.productBrand,
          queryTitle: queries.queryTitle,
          boycottingDetails: queries.boycottingDetails,
          imageURL: queries.imageURL
        },
      };
      const result = await queriesCollection.updateOne(filter, updateDoc, options);
      res.send(result)
    })

    app.patch("/queries/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const currentObject = await queriesCollection.findOne({_id: new ObjectId(id)});
      console.log(currentObject);
      const updateDoc = {
        $set: { recommendationCount: (currentObject.recommendationCount || 0) + 1 },
      };
      const result = await queriesCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(result)
    })

    app.patch("/queries/desRecom/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const currentObject = await queriesCollection.findOne({_id: new ObjectId(id)});
      console.log(currentObject);
      const updateDoc = {
        $set: { recommendationCount: (currentObject.recommendationCount || 0) - 1 },
      };
      const result = await queriesCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc
      );
      res.send(result)
    })

    app.delete("/queries/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await queriesCollection.deleteOne(query);
      res.send(result)
    })

    // recommend
    app.post("/recommend", async (req, res) => {
      const queries = req.body;
      const result = await recommendCollection.insertOne(queries)
      res.send(result)
    })

    app.get("/recommend", async (req, res) => {
      const result = await recommendCollection.find().toArray()
      res.send(result)
    })

    app.get("/recommend/myRecommrnd/:email",verifyToken, async (req, res) => {
      if(req.user.email !== req.params.email){
        return res.status(403).send({message : "forbidden access"})
      }
      query = { recommendationEmail: req.params.email }
      const result = await recommendCollection.find(query).toArray()
      res.send(result)
    })

    app.get("/recommend/RecommendForMe/:email",verifyToken, async (req, res) => {
      if(req.user.email !== req.params.email){
        return res.status(403).send({message : "forbidden access"})
      }
      query = { email: req.params.email }
      const result = await recommendCollection.find(query).toArray()
      res.send(result)
    })

    app.get("/recommend/:queriesId", async (req, res) => {
      query = { queriesId: req.params.queriesId }
      const result = await recommendCollection.find(query).toArray()
      res.send(result)
    })

    app.delete("/recommend/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) };
      const result = await recommendCollection.deleteOne(query);
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/", (req, res) => {
  res.send("ElectroEvo server")
})

app.listen(port, () => {
  console.log("server is runing")
})
