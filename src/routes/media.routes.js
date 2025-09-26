const express=require('express')
const { presign } = require('../controllers/media.controller')
const verifyToken = require('../middleware/auth.middleware')

const router=express.Router()

router.post('/presign',verifyToken,presign)

module.exports=router