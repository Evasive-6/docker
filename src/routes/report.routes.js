const express=require('express')
const { createReport, getReportById, getReportByUser, getPresignedUrl } = require('../controllers/report.controller')
const { rateLimitReports, rateLimitDevices } = require('../middleware/rateLimit.middleware')

const router=express.Router()

// Apply rate limiting to report creation
router.post('/', rateLimitDevices(10), rateLimitReports(5), createReport)
router.get('/presigned-url', getPresignedUrl)
router.get('/:id',getReportById)
router.get('/user/:userId',getReportByUser)

module.exports=router













