const mongoose=require('mongoose')
const { updatePriorityMiddleware, updatePriorityMiddlewareUpdate } = require('../middleware/priority.middleware');


const mediaSchema=new mongoose.Schema({
    key:{
        type:String
    },
    url:{
        type:String
    },
    thumbUrl:{
        type:String
    },
    size:{
        type:Number
    },
    // Location integrity fields
    exifData: {
        hasGPS: { type: Boolean, default: false },
        gpsCoordinates: {
            lat: Number,
            lng: Number
        },
        timestamp: Date,
        isLivePhoto: { type: Boolean, default: false },
        cameraInfo: {
            make: String,
            model: String,
            software: String
        }
    },
    locationIntegrity: {
        isValid: { type: Boolean, default: false },
        distanceDifference: Number,
        issues: [String]
    }
},{_id:false});


const voiceSchema=new mongoose.Schema({
    key:String,
    url:String,
    transcriptRaw:String,
    transcriptSanitized:String
},{_id:false})


const descriptionSchema=new mongoose.Schema({
    raw:{
        type:String,
        default:""
    },
    sanitized:{
        type:String,
        default:""
    }
},{_id:false})


const loactionSchema=new mongoose.Schema({
    type:{type:String,enum:["Point"],default:"Point"},
    coordinates:{type:[Number],index:"2dsphere"}, //longitude,latitudes
    address:{
        type:String,
        default:""
    },
    zipcode:{
        type:String,
        default:""
    },
    district:{
        type:String,
        default:""
    }
},{_id:false});

const reportSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    photos:{
        type:[mediaSchema],
        default:[]
    },
    voice:{
        type:voiceSchema,
        default:{}
    },
    userCategory:{
        type:String,
        // required:true
    },
    //AI fields
    aiCategory:{
        type:String,
        default:""
    },
    aiCategoryConfidence:{
        type:Number,
        default:0
    },
    
    //just mentioning the per-source AI fields
    aiCategoryImage: { type: String, default: "" },
    aiCategoryImageConfidence: { type: Number, default: 0 },
    aiCategoryText: { type: String, default: "" },
    aiCategoryTextConfidence: { type: Number, default: 0 },
    aiCategoryVoice: { type: String, default: "" },
    aiCategoryVoiceConfidence: { type: Number, default: 0 },

    
    aiCategoryConsensus: { type: String, default: "" },
    aiCategoryConsensusConfidence: { type: Number, default: 0 },
    contentSafetyFlag: { type: Boolean, default: false },
    contentSafetyReason: { type: String, default: "" },
    needsManualReview: { type: Boolean, default: false},


    finalCategory:{ //admin can override this after
        type:String,
        default:""
    },


    //AI JOB TRACKING
    aiStatus:{
        type:String,
        enum:["pending","processing","completed","failed"],
        default:"pending"
    },
    aiAttempts: { type: Number, default: 0 },
    aiError: { type: String, default: "" },
    aiRawResponse: { type: mongoose.Schema.Types.Mixed, default: {} },


    description:{
        type:descriptionSchema,
        default:()=>({})
    },
    suggestedSolution:{
        type:descriptionSchema,
        default:()=>({})
    },
    
    location:{
        type:loactionSchema,
        required:true
    },

    priorityScore:{type:Number,default:0},
    sentimentScore:{type:Number,default:0},

    customStatusMessage:{
        type:String,
        default:""
    },
    
    assignedDepartment:{
        type:mongoose.Types.ObjectId,
        ref:"Department"
    },
    assignedMembers:[{
        memberId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Member"
        },
        assignedAt:{
            type:Date,
            default:Date.now
        },
        assignedBy:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Admin"
        }
    }],
    statusHistory: [{
        status: String,
        customMessage: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        changedAt: { type: Date, default: Date.now }
    }],
    categoryHistory: [{
        oldCategory: String,
        newCategory: String,
        reason: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        changedAt: { type: Date, default: Date.now }
    }],
    adminComments: [{
        comment: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
        addedAt: { type: Date, default: Date.now },
        isPublic: { type: Boolean, default: false } // Public comments visible to citizens
    }],
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    estimatedResolutionTime: { type: Date },
    publicStatusMessage: { type: String, default: "" },

    status:{
        type:String,
        enum:["processing", "open", "assigned", "in-progress", "resolved", "flagged", "deleted"],
        default:"processing"
    },

    upvotes:{
        type:Number,default:0
    },

    // Enhanced upvoting system
    upvoteHistory: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        upvotedAt: { type: Date, default: Date.now },
        userLocation: {
            type: {type: String, enum: ["Point"], default: "Point"},
            coordinates: [Number]
        }
    }],

    // Priority and trending
    priorityScore: { type: Number, default: 0 },
    lastPriorityUpdate: { type: Date, default: Date.now },

    // Duplicate detection
    duplicateDetection: {
        isDuplicate: { type: Boolean, default: false },
        confidence: { type: Number, default: 0 },
        relatedReports: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report" }],
        reasons: [String],
        detectedAt: Date
    },

    // Device tracking for rate limiting
    deviceInfo: {
        deviceId: String,
        userAgent: String,
        ipAddress: String
    },

    flagged:{
        type:Boolean,
        default:false
    },
    assignedTo:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Admin",
        default:null
    }

},{timestamps:true});


reportSchema.index({ status: 1, finalCategory: 1, assignedDepartment: 1, flagged: 1, createdAt: -1 });
reportSchema.index({ location: '2dsphere' });
reportSchema.index({ description: 'text' });
reportSchema.index({ priorityScore: -1, upvotes: -1 }); // Index for priority queries

// Add middleware hooks for automatic priority calculation
reportSchema.pre('save', updatePriorityMiddleware);
reportSchema.pre('findOneAndUpdate', updatePriorityMiddlewareUpdate);
reportSchema.pre('updateOne', updatePriorityMiddlewareUpdate);
reportSchema.pre('updateMany', updatePriorityMiddlewareUpdate);


const Report=mongoose.model("Report",reportSchema)
module.exports=Report


