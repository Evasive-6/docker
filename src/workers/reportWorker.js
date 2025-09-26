


// gonna delettt
require("dotenv").config();
const reportQueue = require("./reportQueue");
const Report = require("../models/Report");
const { analyzeAll } = require("../services/aiCategory.service");
const { transcribeFromUrl } = require("../services/stt.service"); // stub or real

const { getDepartmentByCategory } = require("../utils/departmentRouting.util");
const { notifyDepartmentAdmins } = require("../services/notification.service"); // we'll create this next

const mongoose = require('mongoose')

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Worker connected to MongoDB"))
.catch(err => {
    console.error("Worker MongoDB connection error:", err);
    process.exit(1);
});

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

/**
 * Determine final category with priority logic
 */
function determineFinalCategory(analysisResult, userSelectedCategory) {
    // If user explicitly selected a category, use that (admin can change later)
    if (userSelectedCategory && userSelectedCategory.trim() && userSelectedCategory.toLowerCase() !== "citizen") {
        console.log("Using user selected category:", userSelectedCategory);
        return userSelectedCategory;
    }
    
    // Priority 1: High-confidence image analysis
    if (analysisResult.image && 
        analysisResult.image.confidence >= 0.7 && 
        analysisResult.image.mainCategory !== "Other") {
        console.log("Using high-confidence image analysis:", analysisResult.image.mainCategory);
        return analysisResult.image.mainCategory;
    }
    
    // Priority 2: Consensus between sources
    if (analysisResult.consensus && 
        analysisResult.consensus.confidence >= 0.6 &&
        analysisResult.consensus.mainCategory !== "Other") {
        console.log("Using consensus category:", analysisResult.consensus.mainCategory);
        return analysisResult.consensus.mainCategory;
    }
    
    // Priority 3: Best overall result (weighted by our system)
    if (analysisResult.best && 
        analysisResult.best.confidence >= 0.6 &&
        analysisResult.best.mainCategory !== "Other") {
        console.log("Using best weighted result:", analysisResult.best.mainCategory);
        return analysisResult.best.mainCategory;
    }
    
    // Priority 4: Any image analysis (even lower confidence)
    if (analysisResult.image && 
        analysisResult.image.confidence >= 0.4 &&
        analysisResult.image.mainCategory !== "Other") {
        console.log("Using lower-confidence image analysis:", analysisResult.image.mainCategory);
        return analysisResult.image.mainCategory;
    }
    
    // Priority 5: Text analysis
    if (analysisResult.text && 
        analysisResult.text.confidence >= 0.5 &&
        analysisResult.text.mainCategory !== "Other") {
        console.log("Using text analysis:", analysisResult.text.mainCategory);
        return analysisResult.text.mainCategory;
    }
    
    // Priority 6: Voice analysis
    if (analysisResult.voice && 
        analysisResult.voice.confidence >= 0.5 &&
        analysisResult.voice.mainCategory !== "Other") {
        console.log("Using voice analysis:", analysisResult.voice.mainCategory);
        return analysisResult.voice.mainCategory;
    }
    
    // Final fallback
    console.log("Using fallback category: Other");
    return "Other";
}

async function processJob(job) {
    const { reportId } = job.data;
    if (!reportId) throw new Error("No reportId provided");

    const report = await Report.findById(reportId);
    if (!report) throw new Error("Report not found: " + reportId);

    // idempotency: if already processed and status not processing, skip
    if (report.aiStatus === "completed") {
        console.log(`Report ${reportId} already completed`);    
        return;
    }

    // mark processing
    report.aiStatus = "processing";
    await report.save();

    // If voice present but no transcript, run STT (if implemented)
    if (report.voice && report.voice.url && !report.voice.transcriptRaw) {
        try {
            const txt = await transcribeFromUrl(report.voice.url, { language: process.env.STT_LANGUAGE || "en" });
            if (txt) {
                report.voice.transcriptRaw = txt;
                await report.save();
            }
        } catch (sttErr) {
            console.warn("STT error:", sttErr.message || sttErr);
            // continue without transcript
        }
    }

    const imageUrl = report.photos && report.photos.length ? report.photos[0].url : null;
    const text = (report.description && report.description.raw) || "";
    const voiceTranscript = (report.voice && report.voice.transcriptRaw) || null;

    let aiResult;
    try {
        aiResult = await analyzeAll({ image: imageUrl, text, voiceTranscript });
        console.log("AI Analysis Result:", JSON.stringify(aiResult, null, 2));
    } catch (aiErr) {
        console.error("AI analyzeAll error:", aiErr.message || aiErr);
        report.aiStatus = "failed";
        report.aiError = aiErr.message || String(aiErr);
        report.aiAttempts = (report.aiAttempts || 0) + 1;
        await report.save();
        throw aiErr; // let Bull mark job failed and retry per job config
    }

    // 🚨 UPDATED SAFETY CHECK - Now properly sets "Other" category
    if (aiResult.image && aiResult.image.isAppropriate === false) {
        console.warn(`Report ${reportId} flagged for inappropriate content: ${aiResult.image.inappropriateReason}`);
        
        // Flag the report but don't reject it completely
        report.flagged = true;
        report.status = "flagged";
        report.aiStatus = "completed";
        
        // Store the safety info
        report.contentSafetyFlag = true;
        report.contentSafetyReason = aiResult.image.inappropriateReason;
        report.needsManualReview = true;
        
        // ✅ FIXED: Set flagged content to "Other" category instead of empty
        report.finalCategory = "Other";
        report.aiCategory = "Other";
        report.aiCategoryConfidence = 0;
        
        // Set source-specific fields for consistency
        report.aiCategoryImage = "";
        report.aiCategoryImageConfidence = 0;
        report.aiCategoryText = "";
        report.aiCategoryTextConfidence = 0;
        report.aiCategoryVoice = "";
        report.aiCategoryVoiceConfidence = 0;
        
        // No consensus for flagged content
        report.aiCategoryConsensus = "";
        report.aiCategoryConsensusConfidence = 0;
        
        // Store raw response for admin review
        report.aiRawResponse = aiResult;
        
        // Add flag reason for admin context
        report.flaggedReason = aiResult.image.inappropriateReason;
        
        console.log(`Report ${reportId} flagged for manual review:`, {
            flagged: true,
            finalCategory: "Other",
            reason: report.contentSafetyReason,
            needsReview: true
        });
        
        await report.save();
        return; // Stop processing here
    }

    // FIXED: Update per-source fields with correct field names
    report.aiCategoryImage = aiResult.image?.mainCategory || "";
    report.aiCategoryImageConfidence = aiResult.image?.confidence || 0;

    report.aiCategoryText = aiResult.text?.mainCategory || "";
    report.aiCategoryTextConfidence = aiResult.text?.confidence || 0;

    report.aiCategoryVoice = aiResult.voice?.mainCategory || "";
    report.aiCategoryVoiceConfidence = aiResult.voice?.confidence || 0;

    // Store raw AI responses for admin debugging
    report.aiRawResponse = {
        image: aiResult.image || null,
        text: aiResult.text || null,
        voice: aiResult.voice || null,
        best: aiResult.best || null,
        consensus: aiResult.consensus || null,
        debug: aiResult.debug || null
    };

    // FIXED: Set the best overall category
    const best = aiResult.best || { mainCategory: "Other", confidence: 0 };
    report.aiCategory = best.mainCategory;
    report.aiCategoryConfidence = best.confidence;

    // Handle consensus if it exists
    if (aiResult.consensus) {
        report.aiCategoryConsensus = aiResult.consensus.mainCategory;
        report.aiCategoryConsensusConfidence = aiResult.consensus.confidence;
    } else {
        report.aiCategoryConsensus = "";
        report.aiCategoryConsensusConfidence = 0;
    }

    // NEW: Determine final category using priority logic
    // Get user's category selection (should be null if not selected, not "citizen")
    const userSelectedCategory = report.userCategory && 
                                report.userCategory.toLowerCase() !== "citizen" ? 
                                report.userCategory : null;
    
    const finalCategory = determineFinalCategory(aiResult, userSelectedCategory);
    report.finalCategory = finalCategory;

    // FIXED: Only set userCategory if user actually selected something
    if (!userSelectedCategory) {
        report.userCategory = null; // or undefined, depending on your schema
    }

    // mark completed
    report.aiStatus = "completed";
    report.aiError = "";
    report.aiAttempts = (report.aiAttempts || 0) + 1;

    // ✅ NEW: Set safety fields for appropriate content
    report.contentSafetyFlag = false;
    report.contentSafetyReason = "";
    report.needsManualReview = false;
    // Clear any previous flagged reason for appropriate content
    report.flaggedReason = "";

    if (report.finalCategory) {
            try {
                const deptId = await getDepartmentByCategory(report.finalCategory);
                if (deptId) {
                report.assignedDepartment = deptId;
                await report.save();
            
                // Trigger notification to department admins
                await notifyDepartmentAdmins(report.assignedDepartment, report._id);
            
                console.log(`Report ${report._id} assigned to department ${deptId}`);
                }
            } catch (err) {
                console.error("Department assignment error:", err.message || err);
            }
    }

    console.log(`Report ${reportId} processed:`, {
        finalCategory: report.finalCategory,
        userCategory: report.userCategory,
        imageCategory: report.aiCategoryImage,
        imageConfidence: report.aiCategoryImageConfidence,
        bestCategory: report.aiCategory,
        bestConfidence: report.aiCategoryConfidence
    });

    await report.save();
    return;
}

// register processor
reportQueue.process("processReport", CONCURRENCY, async (job) => {
    try {
        await processJob(job);
    } catch (err) {
        console.error("reportWorker job error:", err && err.message ? err.message : err);
        throw err;
    }
});

if (require.main === module) {
    console.log(`Report worker started (concurrency=${CONCURRENCY})`);
}
















////latest working fine 2
// require("dotenv").config();
// const reportQueue = require("./reportQueue");
// const Report = require("../models/Report");
// const { analyzeAll } = require("../services/aiCategory.service");
// const { transcribeFromUrl } = require("../services/stt.service"); // stub or real

// const mongoose = require('mongoose')

// mongoose.connect(process.env.MONGO_URI)
// .then(() => console.log("Worker connected to MongoDB"))
// .catch(err => {
//     console.error("Worker MongoDB connection error:", err);
//     process.exit(1);
// });

// const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

// /**
//  * Determine final category with priority logic
//  */
// function determineFinalCategory(analysisResult, userSelectedCategory) {
//     // If user explicitly selected a category, use that (admin can change later)
//     if (userSelectedCategory && userSelectedCategory.trim() && userSelectedCategory.toLowerCase() !== "citizen") {
//         console.log("Using user selected category:", userSelectedCategory);
//         return userSelectedCategory;
//     }
    
//     // Priority 1: High-confidence image analysis
//     if (analysisResult.image && 
//         analysisResult.image.confidence >= 0.7 && 
//         analysisResult.image.mainCategory !== "Other") {
//         console.log("Using high-confidence image analysis:", analysisResult.image.mainCategory);
//         return analysisResult.image.mainCategory;
//     }
    
//     // Priority 2: Consensus between sources
//     if (analysisResult.consensus && 
//         analysisResult.consensus.confidence >= 0.6 &&
//         analysisResult.consensus.mainCategory !== "Other") {
//         console.log("Using consensus category:", analysisResult.consensus.mainCategory);
//         return analysisResult.consensus.mainCategory;
//     }
    
//     // Priority 3: Best overall result (weighted by our system)
//     if (analysisResult.best && 
//         analysisResult.best.confidence >= 0.6 &&
//         analysisResult.best.mainCategory !== "Other") {
//         console.log("Using best weighted result:", analysisResult.best.mainCategory);
//         return analysisResult.best.mainCategory;
//     }
    
//     // Priority 4: Any image analysis (even lower confidence)
//     if (analysisResult.image && 
//         analysisResult.image.confidence >= 0.4 &&
//         analysisResult.image.mainCategory !== "Other") {
//         console.log("Using lower-confidence image analysis:", analysisResult.image.mainCategory);
//         return analysisResult.image.mainCategory;
//     }
    
//     // Priority 5: Text analysis
//     if (analysisResult.text && 
//         analysisResult.text.confidence >= 0.5 &&
//         analysisResult.text.mainCategory !== "Other") {
//         console.log("Using text analysis:", analysisResult.text.mainCategory);
//         return analysisResult.text.mainCategory;
//     }
    
//     // Priority 6: Voice analysis
//     if (analysisResult.voice && 
//         analysisResult.voice.confidence >= 0.5 &&
//         analysisResult.voice.mainCategory !== "Other") {
//         console.log("Using voice analysis:", analysisResult.voice.mainCategory);
//         return analysisResult.voice.mainCategory;
//     }
    
//     // Final fallback
//     console.log("Using fallback category: Other");
//     return "Other";
// }

// async function processJob(job) {
//     const { reportId } = job.data;
//     if (!reportId) throw new Error("No reportId provided");

//     const report = await Report.findById(reportId);
//     if (!report) throw new Error("Report not found: " + reportId);

//     // idempotency: if already processed and status not processing, skip
//     if (report.aiStatus === "completed") {
//         console.log(`Report ${reportId} already completed`);    
//         return;
//     }

//     // mark processing
//     report.aiStatus = "processing";
//     await report.save();

//     // If voice present but no transcript, run STT (if implemented)
//     if (report.voice && report.voice.url && !report.voice.transcriptRaw) {
//         try {
//             const txt = await transcribeFromUrl(report.voice.url, { language: process.env.STT_LANGUAGE || "en" });
//             if (txt) {
//                 report.voice.transcriptRaw = txt;
//                 await report.save();
//             }
//         } catch (sttErr) {
//             console.warn("STT error:", sttErr.message || sttErr);
//             // continue without transcript
//         }
//     }

//     const imageUrl = report.photos && report.photos.length ? report.photos[0].url : null;
//     const text = (report.description && report.description.raw) || "";
//     const voiceTranscript = (report.voice && report.voice.transcriptRaw) || null;

//     let aiResult;
//     try {
//         aiResult = await analyzeAll({ image: imageUrl, text, voiceTranscript });
//         console.log("AI Analysis Result:", JSON.stringify(aiResult, null, 2));
//     } catch (aiErr) {
//         console.error("AI analyzeAll error:", aiErr.message || aiErr);
//         report.aiStatus = "failed";
//         report.aiError = aiErr.message || String(aiErr);
//         report.aiAttempts = (report.aiAttempts || 0) + 1;
//         await report.save();
//         throw aiErr; // let Bull mark job failed and retry per job config
//     }

//     // 🚨 ADD THE SAFETY CHECK HERE
//     if (aiResult.image && aiResult.image.isAppropriate === false) {
//         console.warn(`Report ${reportId} flagged for inappropriate content: ${aiResult.image.inappropriateReason}`);
        
//         // Flag the report but don't reject it completely
//         report.flagged = true;
//         report.status = "flagged";
//         report.aiStatus = "completed";
        
//         // Store the safety info
//         report.contentSafetyFlag = true;
//         report.contentSafetyReason = aiResult.image.inappropriateReason;
//         report.needsManualReview = true;
        
//         // Don't set categories for inappropriate content
//         report.finalCategory = "";
//         report.aiCategory = "";
//         report.aiCategoryConfidence = 0;
        
//         // Store raw response for admin review
//         report.aiRawResponse = aiResult;
        
//         console.log(`Report ${reportId} flagged for manual review:`, {
//             flagged: true,
//             reason: report.contentSafetyReason,
//             needsReview: true
//         });
        
//         await report.save();
//         return; // Stop processing here
//     }

//     // FIXED: Update per-source fields with correct field names
//     report.aiCategoryImage = aiResult.image?.mainCategory || "";
//     report.aiCategoryImageConfidence = aiResult.image?.confidence || 0;

//     report.aiCategoryText = aiResult.text?.mainCategory || "";
//     report.aiCategoryTextConfidence = aiResult.text?.confidence || 0;

//     report.aiCategoryVoice = aiResult.voice?.mainCategory || "";
//     report.aiCategoryVoiceConfidence = aiResult.voice?.confidence || 0;

//     // Store raw AI responses for admin debugging
//     report.aiRawResponse = {
//         image: aiResult.image || null,
//         text: aiResult.text || null,
//         voice: aiResult.voice || null,
//         best: aiResult.best || null,
//         consensus: aiResult.consensus || null,
//         debug: aiResult.debug || null
//     };

//     // FIXED: Set the best overall category
//     const best = aiResult.best || { mainCategory: "Other", confidence: 0 };
//     report.aiCategory = best.mainCategory;
//     report.aiCategoryConfidence = best.confidence;

//     // Handle consensus if it exists
//     if (aiResult.consensus) {
//         report.aiCategoryConsensus = aiResult.consensus.mainCategory;
//         report.aiCategoryConsensusConfidence = aiResult.consensus.confidence;
//     } else {
//         report.aiCategoryConsensus = "";
//         report.aiCategoryConsensusConfidence = 0;
//     }

//     // NEW: Determine final category using priority logic
//     // Get user's category selection (should be null if not selected, not "citizen")
//     const userSelectedCategory = report.userCategory && 
//                                 report.userCategory.toLowerCase() !== "citizen" ? 
//                                 report.userCategory : null;
    
//     const finalCategory = determineFinalCategory(aiResult, userSelectedCategory);
//     report.finalCategory = finalCategory;

//     // FIXED: Only set userCategory if user actually selected something
//     if (!userSelectedCategory) {
//         report.userCategory = null; // or undefined, depending on your schema
//     }

//     // mark completed
//     report.aiStatus = "completed";
//     report.aiError = "";
//     report.aiAttempts = (report.aiAttempts || 0) + 1;

//     // ✅ NEW: Set safety fields for appropriate content
//     report.contentSafetyFlag = false;
//     report.contentSafetyReason = "";
//     report.needsManualReview = false;

//     console.log(`Report ${reportId} processed:`, {
//         finalCategory: report.finalCategory,
//         userCategory: report.userCategory,
//         imageCategory: report.aiCategoryImage,
//         imageConfidence: report.aiCategoryImageConfidence,
//         bestCategory: report.aiCategory,
//         bestConfidence: report.aiCategoryConfidence
//     });

//     await report.save();
//     return;
// }

// // register processor
// reportQueue.process("processReport", CONCURRENCY, async (job) => {
//     try {
//         await processJob(job);
//     } catch (err) {
//         console.error("reportWorker job error:", err && err.message ? err.message : err);
//         throw err;
//     }
// });

// if (require.main === module) {
//     console.log(`Report worker started (concurrency=${CONCURRENCY})`);
// }





















// ///current working
// require("dotenv").config();
// const reportQueue = require("./reportQueue");
// const Report = require("../models/Report");
// const { analyzeAll } = require("../services/aiCategory.service");
// const { transcribeFromUrl } = require("../services/stt.service"); // stub or real

// const mongoose = require('mongoose')

// mongoose.connect(process.env.MONGO_URI)
// .then(() => console.log("Worker connected to MongoDB"))
// .catch(err => {
//     console.error("Worker MongoDB connection error:", err);
//     process.exit(1);
// });

// const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

// /**
//  * Determine final category with priority logic
//  */
// function determineFinalCategory(analysisResult, userSelectedCategory) {
//     // If user explicitly selected a category, use that (admin can change later)
//     if (userSelectedCategory && userSelectedCategory.trim() && userSelectedCategory.toLowerCase() !== "citizen") {
//         console.log("Using user selected category:", userSelectedCategory);
//         return userSelectedCategory;
//     }
    
//     // Priority 1: High-confidence image analysis
//     if (analysisResult.image && 
//         analysisResult.image.confidence >= 0.7 && 
//         analysisResult.image.mainCategory !== "Other") {
//         console.log("Using high-confidence image analysis:", analysisResult.image.mainCategory);
//         return analysisResult.image.mainCategory;
//     }
    
//     // Priority 2: Consensus between sources
//     if (analysisResult.consensus && 
//         analysisResult.consensus.confidence >= 0.6 &&
//         analysisResult.consensus.mainCategory !== "Other") {
//         console.log("Using consensus category:", analysisResult.consensus.mainCategory);
//         return analysisResult.consensus.mainCategory;
//     }
    
//     // Priority 3: Best overall result (weighted by our system)
//     if (analysisResult.best && 
//         analysisResult.best.confidence >= 0.6 &&
//         analysisResult.best.mainCategory !== "Other") {
//         console.log("Using best weighted result:", analysisResult.best.mainCategory);
//         return analysisResult.best.mainCategory;
//     }
    
//     // Priority 4: Any image analysis (even lower confidence)
//     if (analysisResult.image && 
//         analysisResult.image.confidence >= 0.4 &&
//         analysisResult.image.mainCategory !== "Other") {
//         console.log("Using lower-confidence image analysis:", analysisResult.image.mainCategory);
//         return analysisResult.image.mainCategory;
//     }
    
//     // Priority 5: Text analysis
//     if (analysisResult.text && 
//         analysisResult.text.confidence >= 0.5 &&
//         analysisResult.text.mainCategory !== "Other") {
//         console.log("Using text analysis:", analysisResult.text.mainCategory);
//         return analysisResult.text.mainCategory;
//     }
    
//     // Priority 6: Voice analysis
//     if (analysisResult.voice && 
//         analysisResult.voice.confidence >= 0.5 &&
//         analysisResult.voice.mainCategory !== "Other") {
//         console.log("Using voice analysis:", analysisResult.voice.mainCategory);
//         return analysisResult.voice.mainCategory;
//     }
    
//     // Final fallback
//     console.log("Using fallback category: Other");
//     return "Other";
// }

// async function processJob(job) {
//     const { reportId } = job.data;
//     if (!reportId) throw new Error("No reportId provided");

//     const report = await Report.findById(reportId);
//     if (!report) throw new Error("Report not found: " + reportId);

//     // idempotency: if already processed and status not processing, skip
//     if (report.aiStatus === "completed") {
//         console.log(`Report ${reportId} already completed`);    
//         return;
//     }

//     // mark processing
//     report.aiStatus = "processing";
//     await report.save();

//     // If voice present but no transcript, run STT (if implemented)
//     if (report.voice && report.voice.url && !report.voice.transcriptRaw) {
//         try {
//             const txt = await transcribeFromUrl(report.voice.url, { language: process.env.STT_LANGUAGE || "en" });
//             if (txt) {
//                 report.voice.transcriptRaw = txt;
//                 await report.save();
//             }
//         } catch (sttErr) {
//             console.warn("STT error:", sttErr.message || sttErr);
//             // continue without transcript
//         }
//     }

//     const imageUrl = report.photos && report.photos.length ? report.photos[0].url : null;
//     const text = (report.description && report.description.raw) || "";
//     const voiceTranscript = (report.voice && report.voice.transcriptRaw) || null;

//     let aiResult;
//     try {
//         aiResult = await analyzeAll({ image: imageUrl, text, voiceTranscript });
//         console.log("AI Analysis Result:", JSON.stringify(aiResult, null, 2));
//     } catch (aiErr) {
//         console.error("AI analyzeAll error:", aiErr.message || aiErr);
//         report.aiStatus = "failed";
//         report.aiError = aiErr.message || String(aiErr);
//         report.aiAttempts = (report.aiAttempts || 0) + 1;
//         await report.save();
//         throw aiErr; // let Bull mark job failed and retry per job config
//     }

//     // FIXED: Update per-source fields with correct field names
//     report.aiCategoryImage = aiResult.image?.mainCategory || "";
//     report.aiCategoryImageConfidence = aiResult.image?.confidence || 0;

//     report.aiCategoryText = aiResult.text?.mainCategory || "";
//     report.aiCategoryTextConfidence = aiResult.text?.confidence || 0;

//     report.aiCategoryVoice = aiResult.voice?.mainCategory || "";
//     report.aiCategoryVoiceConfidence = aiResult.voice?.confidence || 0;

//     // Store raw AI responses for admin debugging
//     report.aiRawResponse = {
//         image: aiResult.image || null,
//         text: aiResult.text || null,
//         voice: aiResult.voice || null,
//         best: aiResult.best || null,
//         consensus: aiResult.consensus || null,
//         debug: aiResult.debug || null
//     };

//     // FIXED: Set the best overall category
//     const best = aiResult.best || { mainCategory: "Other", confidence: 0 };
//     report.aiCategory = best.mainCategory;
//     report.aiCategoryConfidence = best.confidence;

//     // Handle consensus if it exists
//     if (aiResult.consensus) {
//         report.aiCategoryConsensus = aiResult.consensus.mainCategory;
//         report.aiCategoryConsensusConfidence = aiResult.consensus.confidence;
//     } else {
//         report.aiCategoryConsensus = "";
//         report.aiCategoryConsensusConfidence = 0;
//     }

//     // NEW: Determine final category using priority logic
//     // Get user's category selection (should be null if not selected, not "citizen")
//     const userSelectedCategory = report.userCategory && 
//                                 report.userCategory.toLowerCase() !== "citizen" ? 
//                                 report.userCategory : null;
    
//     const finalCategory = determineFinalCategory(aiResult, userSelectedCategory);
//     report.finalCategory = finalCategory;

//     // FIXED: Only set userCategory if user actually selected something
//     if (!userSelectedCategory) {
//         report.userCategory = null; // or undefined, depending on your schema
//     }

//     // mark completed
//     report.aiStatus = "completed";
//     report.aiError = "";
//     report.aiAttempts = (report.aiAttempts || 0) + 1;

//     console.log(`Report ${reportId} processed:`, {
//         finalCategory: report.finalCategory,
//         userCategory: report.userCategory,
//         imageCategory: report.aiCategoryImage,
//         imageConfidence: report.aiCategoryImageConfidence,
//         bestCategory: report.aiCategory,
//         bestConfidence: report.aiCategoryConfidence
//     });

//     await report.save();
//     return;
// }

// // register processor
// reportQueue.process("processReport", CONCURRENCY, async (job) => {
//     try {
//         await processJob(job);
//     } catch (err) {
//         console.error("reportWorker job error:", err && err.message ? err.message : err);
//         throw err;
//     }
// });

// if (require.main === module) {
//     console.log(`Report worker started (concurrency=${CONCURRENCY})`);
// }

// require("dotenv").config();
// const reportQueue = require("./reportQueue");
// const Report = require("../models/Report");
// const { analyzeAll } = require("../services/aiCategory.service");
// const { transcribeFromUrl } = require("../services/stt.service"); // stub or real

// const mongoose=require('mongoose')

// mongoose.connect(process.env.MONGO_URI)
// .then(() => console.log("Worker connected to MongoDB"))
// .catch(err => {
//     console.error("Worker MongoDB connection error:", err);
//     process.exit(1);
// });



// const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);

// async function processJob(job) {
//     const { reportId } = job.data;
//     if (!reportId) throw new Error("No reportId provided");

//     const report = await Report.findById(reportId);
//     if (!report) throw new Error("Report not found: " + reportId);

//     // idempotency: if already processed and status not processing, skip
//     if (report.aiStatus === "completed") {
//         console.log(`Report ${reportId} already completed`);    
//         return;
//     }

//     // mark processing
//     report.aiStatus = "processing";
//     await report.save();

//     // If voice present but no transcript, run STT (if implemented)
//     if (report.voice && report.voice.url && !report.voice.transcriptRaw) {
//         try {
//         const txt = await transcribeFromUrl(report.voice.url, { language: process.env.STT_LANGUAGE || "en" });
//         if (txt) {
//             report.voice.transcriptRaw = txt;
//             await report.save();
//         }
//         } catch (sttErr) {
//         console.warn("STT error:", sttErr.message || sttErr);
//         // continue without transcript
//         }
//     }

//     const imageUrl = report.photos && report.photos.length ? report.photos[0].url : null;
//     const text = (report.description && report.description.raw) || "";
//     const voiceTranscript = (report.voice && report.voice.transcriptRaw) || null;

//     let aiResult;
//     try {
//         aiResult = await analyzeAll({ image: imageUrl, text, voiceTranscript });
//     } catch (aiErr) {
//         console.error("AI analyzeAll error:", aiErr.message || aiErr);
//         report.aiStatus = "failed";
//         report.aiError = aiErr.message || String(aiErr);
//         report.aiAttempts = (report.aiAttempts || 0) + 1;
//         await report.save();
//         throw aiErr; // let Bull mark job failed and retry per job config
//     }

//     // update per-source fields + raw
//     report.aiCategoryImage = aiResult.image?.category || "";
//     report.aiCategoryImageConfidence = aiResult.image?.confidence || 0;

//     report.aiCategoryText = aiResult.text?.category || "";
//     report.aiCategoryTextConfidence = aiResult.text?.confidence || 0;

//     report.aiCategoryVoice = aiResult.voice?.category || "";
//     report.aiCategoryVoiceConfidence = aiResult.voice?.confidence || 0;

//     report.aiRawResponse = {
//         image: aiResult.image?.raw || "",
//         text: aiResult.text?.raw || "",
//         voice: aiResult.voice?.raw || ""
//     };

//     // choose best / consensus
//     const best = aiResult.best || { category: "Other", confidence: 0 };
//     report.aiCategory = best.category;
//     report.aiCategoryConfidence = best.confidence;

//     if (aiResult.consensus) {
//         report.aiCategory = aiResult.consensus.category;
//         report.aiCategoryConfidence = aiResult.consensus.confidence;
//         report.aiCategoryConsensus = aiResult.consensus.category;
//         report.aiCategoryConsensusConfidence = aiResult.consensus.confidence;
//     } else {
//         report.aiCategoryConsensus = "";
//         report.aiCategoryConsensusConfidence = 0;
//     }

//     // mark completed
//     report.aiStatus = "completed";
//     report.aiError = "";
//     report.aiAttempts = (report.aiAttempts || 0) + 1;
//     await report.save();
//     return;
//     }

//     // register processor
//     reportQueue.process("processReport", CONCURRENCY, async (job) => {
//     try {
//         await processJob(job);
//     } catch (err) {
//         console.error("reportWorker job error:", err && err.message ? err.message : err);
//         throw err;
//     }
//     });

//     if (require.main === module) {
//     console.log(`Report worker started (concurrency=${CONCURRENCY})`);
//     }