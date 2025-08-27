import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes.js';
import activitiesRoutes from './routes/activities.routes.js';
import enrollmentsRoutes from './routes/enrollments.routes.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/enrollments', enrollmentsRoutes);

export default app;
