// PACKAGE IMPORTS
import cors from 'cors';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
import express from 'express';
import joi from 'joi';
import { MongoClient } from 'mongodb';

// SERVER CONFIG
const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

// DATABASE CONFIG
let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
  .then(() => { db = mongoClient.db(); })
  .catch((error) => { console.log(error.message); });

// GLOBAL CONSTANTS
const PORT_NUMBER = 5000;

// ENDPOINTS
app.post('/participants', async (req, res) => {
  const { name } = req.body;
  const participantSchema = joi.object({
    name: joi.string().min(1).required(),
  });

  const validation = participantSchema.validate({ name }, { abortEarly: false });
  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const participant = await db.collection('participants').findOne({ name });
    if (participant) return res.sendStatus(409);

    await db.collection('participants').insertOne({ name, lastStatus: Date.now() });
    await db.collection('messages').insertOne({
      from: name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss'),
    });

    return res.sendStatus(201);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

// FUNCTIONS
app.listen(PORT_NUMBER, () => console.log(`Running server on port ${PORT_NUMBER}`));
