/* eslint-disable no-unused-vars*/

require('dotenv').config()
const express=require('express')
const cors=require('cors')


const authRoutes=require('./routes/auth.routes')
const adminRoutes=require('./routes/admin.routes')
const reportRoutes=require('./routes/report.routes')
const mediaRoutes =require('./routes/media.routes')
const publicRoutes = require('./routes/public.routes')
const notificationRoutes = require('./routes/notification.routes')
const queueRoutes = require('./routes/queue.routes')
const utilityRoutes = require('./routes/utility.routes')




const app=express()

// CORS configuration for local development
const corsOptions = {
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id'],
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions))
app.use(express.json())

// Debug middleware to log CORS requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

app.use('/auth',authRoutes)
app.use('/admin',adminRoutes)
app.use('/api/reports',reportRoutes)  // Fixed path to match API documentation
app.use('/api/media',mediaRoutes)
app.use('/api/public', publicRoutes)  // Public routes - NO AUTH
app.use('/api/notifications', notificationRoutes)  // Admin notifications
app.use('/admin/queue', queueRoutes)  // Queue management
app.use('/utility', utilityRoutes)  // Utility routes


app.get('/',(req,res)=>{
    res.send("Civic Saathi Backend API running")
})

module.exports=app