import dotenv from 'dotenv';
import express, { Application } from 'express';
import cors from 'cors';
import connectDB from './config/db';

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

app.get('/api/v1', (req, res) => {
  res.json({ success: true, message: 'NeuroScan AI API v1', version: '1.0.0' });
});

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
};

startServer();
