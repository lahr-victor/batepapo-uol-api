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

// GLOBAL VARIABLES
const refreshInterval = 15000;

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

app.get('/participants', async (req, res) => {
  try {
    const participants = await db.collection('participants').find().toArray();
    return res.send(participants);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post('/messages', async (req, res) => {
  const { user: from } = req.headers;
  const { to, text, type } = req.body;
  const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().min(1).required(),
    text: joi.string().min(1).required(),
    type: joi.string().required().valid('message', 'private_message'),
  });

  const validation = messageSchema.validate({
    from,
    to,
    text,
    type,
  }, { abortEarly: false });
  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const participant = await db.collection('participants').findOne({ name: from });
    if (!participant) return res.sendStatus(422);

    await db.collection('messages').insertOne({
      from,
      to,
      text,
      type,
      time: dayjs().format('HH:mm:ss'),
    });

    return res.sendStatus(201);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.get('/messages', async (req, res) => {
  const { user: from } = req.headers;
  const { limit } = req.query;
  const limitSchema = joi.object({
    limit: joi.number().greater(0).optional(),
  });

  const validation = limitSchema.validate({ limit });
  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const messages = await db.collection('messages')
      .find({
        $or: [
          { from },
          { to: { $in: [from, 'Todos'] } },
        ],
      })
      .sort({ _id: -1 })
      .limit(!limit ? 0 : Number(limit))
      .toArray();

    return res.send(messages);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post('/status', async (req, res) => {
  const { user: name } = req.headers;
  if (!name) return res.sendStatus(404);

  try {
    const participant = await db.collection('participants').findOne({ name });
    if (!participant) return res.sendStatus(422);

    const update = await db.collection('participants').updateOne({ name }, { $set: { lastStatus: Date.now() } });
    if (update.matchedCount === 0) return res.sendStatus(404);

    return res.sendStatus(200);
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

// FUNCTIONS
setInterval(async () => {
  const removalThreshold = Date.now() - 10000;
  const participants = await db.collection('participants').find({ lastStatus: { $lt: removalThreshold } }).toArray();

  if (participants.length > 0) {
    await db.collection('participants').deleteMany({ lastStatus: { $lt: removalThreshold } });
    await db.collection('messages').insertMany(participants.map((participant) => (
      {
        from: participant.name,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss'),
      }
    )));
  }
}, refreshInterval);

app.listen(PORT_NUMBER, () => console.log(`Running server on port ${PORT_NUMBER}`));
