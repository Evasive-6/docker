// src/controllers/report.controller.js
const mongoose = require("mongoose");
const Report = require("../models/Report");
const reportQueue = require("../workers/reportQueue");
const User = require("../models/User"); // validate userId exists
const { getPresignedPutUrl, getPublicUrl } = require("../services/fileUpload.service");
const LocationIntegrityService = require("../services/locationIntegrity.service");
const DuplicateDetectionService = require("../services/duplicateDetection.service");

/**
 * Create Report
 * Accepts authenticated user (req.user) OR userId in body (for testing).
 */
const createReport = async (req, res) => {
  try {
    // determine userId: prefer authenticated user
    const userId = (req.user && req.user._id) || req.body.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required (either authenticate or pass userId in body)" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // optional: ensure the user exists
    const userExists = await User.findById(userId).select("_id");
    if (!userExists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // location validation (Report schema requires location)
    const location = req.body.location;
    if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      return res.status(400).json({ success: false, message: "location is required and must include coordinates [long, lat]" });
    }

    // Check for duplicate reports before creating
    const duplicateCheck = await DuplicateDetectionService.checkForDuplicates({
      location,
      description: { raw: req.body.description || "" },
      userCategory: req.body.userCategory || "",
      finalCategory: req.body.finalCategory || ""
    });

    const payload = {
      userId: userId,
      photos: Array.isArray(req.body.photos) ? req.body.photos : [],
      voice: req.body.voice || {},
      description: { raw: req.body.description || "" },
      suggestedSolution: { raw: req.body.suggestedSolution || "" },
      location,
      userCategory: req.body.userCategory || "",
      aiStatus: "pending",
      status: "processing",
      // Add device tracking for rate limiting
      deviceInfo: {
        deviceId: req.headers['x-device-id'] || null,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || req.connection.remoteAddress
      }
    };

    // If duplicates found with high confidence, flag for review
    if (duplicateCheck.isDuplicate && duplicateCheck.confidence > 80) {
      payload.flagged = true;
      payload.needsManualReview = true;
      payload.customStatusMessage = `Potential duplicate - ${duplicateCheck.reasons.join(', ')}`;
      payload.duplicateDetection = duplicateCheck;
    }

    const report = new Report(payload);
    const saved = await report.save();

    // Mark as potential duplicate if detected
    if (duplicateCheck.isDuplicate) {
      await DuplicateDetectionService.markAsPotentialDuplicate(saved._id, duplicateCheck);
    }

    // add to worker queue (ensure Redis/worker are running)
    await reportQueue.add(
      "processReport",
      { reportId: saved._id.toString() },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    // Prepare response
    const response = {
      success: true, 
      report: saved
    };

    // Add duplicate warning if detected
    if (duplicateCheck.isDuplicate) {
      response.warning = {
        type: 'potential_duplicate',
        message: 'This report may be similar to existing reports in the area',
        confidence: duplicateCheck.confidence,
        reasons: duplicateCheck.reasons
      };
    }

    return res.status(201).json(response);
  } catch (err) {
    console.error("createReport error:", err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

/**
 * Get report by id (single canonical function)
 */
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("userId", "phoneNumber") // adjust fields as needed
      .populate("assignedTo", "email profile");

    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    return res.json({ success: true, report });
  } catch (err) {
    console.error("getReportById error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

/**
 * Get all reports by a user
 */
const getReportByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }
    const reports = await Report.find({ userId }).sort({ createdAt: -1 });
    return res.json({ success: true, reports });
  } catch (err) {
    console.error("getReportByUser error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

/**
 * Get presigned URL for file upload
 */
const getPresignedUrl = async (req, res) => {
  try {
    const { fileName, contentType = "image/jpeg" } = req.query;
    
    if (!fileName) {
      return res.status(400).json({ success: false, message: "fileName is required" });
    }

    const safeName = fileName.replace(/\s+/g, "_");
    const key = `uploads/images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    
    const uploadUrl = await getPresignedPutUrl(key, contentType);
    const publicUrl = await getPublicUrl(key);
    
    return res.json({ 
      success: true, 
      uploadUrl, 
      publicUrl, 
      key 
    });
  } catch (err) {
    console.error("getPresignedUrl error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

module.exports = { createReport, getReportById, getReportByUser, getPresignedUrl };








// // const { report } = require("../express");
// const Report = require("../models/Report");
// const reportQueue = require("../workers/reportQueue");

// const createReport=async(req,res)=>{
//     try {
//     const payload = {
//       userId: req.user ? req.user._id : null,
//       photos: req.body.photos || [],
//       voice: req.body.voice || {},
//       description: { raw: req.body.description || "" },
//       suggestedSolution: { raw: req.body.suggestedSolution || "" },
//       location: req.body.location,
//       userCategory: req.body.userCategory || "",
//       aiStatus: "pending",
//       status: "processing"
//     };

//     const report = new Report(payload);
//     const saved = await report.save();

//     await reportQueue.add(
//         "processReport",
//         { reportId: saved._id.toString() },
//             {   
//             attempts: 3,
//             backoff: { type: "exponential", delay: 5000 },
//             removeOnComplete: true,
//             removeOnFail: false
//         }
//     );

//     return res.status(201).json({ success: true, report: saved });
//   } catch (err) {
//     console.error("createReport error:", err && err.message ? err.message : err);
//     return res.status(500).json({ success: false, message: err.message });
//   }
// };

// // GET REPORT BY ID
// exports.getReportById = async (req, res) => {
//   try {
//     const report = await Report.findById(req.params.id)
//       .populate("userId", "name email")
//       .populate("assignedTo", "name email");
//     if (!report) return res.status(404).json({ success: false, message: "Report not found" });
//     return res.json({ success: true, report });
//   } catch (err) {
//     console.error("getReportById error:", err);
//     return res.status(500).json({ success: false, message: err.message });
//   }
// }

// const getReportById=async(req,res)=>{
//     try{

//         const report=await Report.findById(req.params.id)

//         if(!report){
//             return res.status(404).json({message:"Report not found"})
//         }
//         res.json(report)

//     }catch(err){
//         console.error("Error catching  report",error)
//         res.status(500)

//     }
// }



// const getReportByUser=async(req,res)=>{

//     try{

//         const reports=await Report.find({userId:req.params.userId})
//         res.json(reports)

//     }catch(err){

//         console.error("Error fetching reports ",err)
//         res.status(500).json({message:"Server error"})

//     }

// }


// module.exports={getReportById,getReportByUser,createReport}