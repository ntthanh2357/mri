import dotenv from 'dotenv';
import express, { Application } from 'express';
import cors from 'cors';
import connectDB from './config/db';
import apiRoutes from './routes';

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());
app.use('/api/v1', apiRoutes);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'NeuroScan AI Backend is healthy' });
});

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
};

startServer();
