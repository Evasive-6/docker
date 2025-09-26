const express=require('express')
const { requestOtp, verifyOtp, getUserProfile, login } = require('../controllers/auth.controller')
const verifyToken = require('../middleware/auth.middleware')
const router=express.Router()

router.post('/login', login)  // New unified login endpoint
router.post('/send-otp', requestOtp)  // Renamed from request-otp
router.post('/request-otp', requestOtp)  // Keep old name for backward compatibility
router.post('/verify-otp', verifyOtp)
router.get('/me', verifyToken, getUserProfile)  // New endpoint

module.exports=router
