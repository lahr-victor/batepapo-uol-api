// PACKAGE IMPORTS
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
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

// FUNCTIONS
app.listen(PORT_NUMBER, () => console.log(`Running server on port ${PORT_NUMBER}`));
