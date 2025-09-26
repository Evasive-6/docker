
// other one gonna delete now
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

let geminiModel = null
const USE_GEMINI = process.env.USE_GEMINI !== "false" && !!process.env.GEMINI_API_KEY;

if (USE_GEMINI) {
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Try different model versions in order of preference
    const models = ["gemini-2.5-flash-preview-09-2025", "gemini-1.0-pro-vision", "gemini-pro-vision"];
    let modelInitialized = false;
    
    for (const modelName of models) {
      try {
        geminiModel = client.getGenerativeModel({ model: modelName });
        console.log(`✅ Gemini initialized with model: ${modelName}`);
        modelInitialized = true;
        break;
      } catch (modelError) {
        console.warn(`❌ Failed to initialize model ${modelName}:`, modelError.message);
        continue;
      }
    }
    
    if (!modelInitialized) {
      console.warn("All Gemini models failed to initialize — falling back to keyword classifier.");
      geminiModel = null;
    }
  } catch (e) {
    console.warn("Gemini init failed — falling back to keyword classifier.", e.message || e);
    geminiModel = null;
  }
}

/* ---------------- Enhanced Category mapping ---------------- */
const ENHANCED_CATEGORY_DEFINITIONS = {
  "Road & Infrastructure": {
    keywords: [
      // Road surface issues
      "pothole", "potholes", "sinkhole", "hole in road", "road crack", "surface crack",
      "damaged road", "broken road", "uneven surface", "road erosion", "road collapse",
      "road subsidence", "worn pavement", "rough road", "bumpy road", "crater",
      "asphalt damage", "concrete crack", "pavement failure", "road deterioration",
      "surface depression", "road rut", "rutting", "alligator cracking", "edge cracking",
      
      // Footpath/sidewalk issues  
      "broken footpath", "damaged sidewalk", "missing tiles", "crack on footpath",
      "uneven pavement", "trip hazard", "broken kerb", "damaged curb", "walkway damage",
      "pedestrian path", "footway", "pavement slab", "paving stone", "sidewalk repair",
      "footpath obstruction", "walkway blocked", "pedestrian safety",
      
      // Manholes and utilities on roads
      "manhole cover missing", "open manhole", "sunken manhole", "protruding manhole",
      "manhole cover displaced", "utility cover missing", "access cover", "drain cover",
      "inspection chamber", "utility access", "roadway opening", "street opening",
      
      // Road obstructions and debris
      "road blockage", "obstruction on road", "fallen tree on road", "road debris",
      "construction debris on road", "abandoned vehicle", "illegal parking on road",
      "roadway obstruction", "traffic obstruction", "vehicle breakdown", "cargo spill",
      "construction equipment", "barricade", "road closure", "lane blocked",
      
      // Bridge and structural infrastructure
      "bridge damage", "damaged bridge", "collapsed bridge", "structural failure",
      "damaged viaduct", "pier damage", "embankment breach", "retaining wall",
      "guardrail damage", "barrier damage", "overpass", "underpass", "tunnel damage",
      "infrastructure collapse", "structural crack", "foundation failure",
      
      // Road markings and signage infrastructure
      "faded road markings", "missing lane markings", "zebra crossing faded",
      "road sign damaged", "signpost bent", "traffic sign missing", "road paint",
      "lane divider", "center line", "edge line", "crosswalk marking"
    ],
    priority: 1
  },

  "Water & Sewerage": {
    keywords: [
      // Water leaks and bursts
      "water leak", "burst pipe", "pipe leak", "water main break", "pipeline leak",
      "pipeline burst", "water overflow", "flooding", "water logging", "standing water",
      "burst water main", "water gushing", "water spray", "pipe rupture", "water wastage",
      "supply line break", "distribution pipe", "service line", "water main", "hydrant leak",
      "valve leak", "meter leak", "connection leak", "joint failure", "pipe failure",
      
      // Sewage issues
      "sewage leak", "sewer leak", "raw sewage", "sewage overflow", "sewer blockage",
      "clogged sewer", "sewerage", "sewer line", "sewage line", "toilet overflow",
      "septic overflow", "waste water", "effluent", "sewage backup", "sewer backup",
      "manhole sewage", "sewage smell", "sewage on road", "sewage in drain",
      
      // Drainage problems
      "drain", "blocked drain", "clogged drain", "choked drain", "overflowing drain",
      "open drain", "damaged drain", "drain collapse", "garbage in drain",
      "drain cover missing", "drainage blockage", "waterlogged area", "storm drain",
      "surface drainage", "roadside drain", "kerb drain", "gutter", "channel",
      "culvert", "inlet blocked", "outlet blocked", "drainage pipe", "catch basin",
      "stormwater", "rainwater drainage", "surface water", "puddle", "water accumulation",
      
      // Sanitation facilities
      "public toilet", "unclean public toilet", "dirty urinal", "filthy restroom",
      "toilet block", "sanitation", "public health hazard", "foul smell", "bad odour",
      "restroom", "washroom", "lavatory", "public convenience", "comfort station",
      "toilet facility", "sanitary facility", "hygiene issue", "cleaning required"
    ],
    priority: 1
  },

  "Waste Management": {
    keywords: [
      // General waste
      "garbage", "trash", "rubbish", "refuse", "debris", "waste", "litter",
      "scattered waste", "dump", "dumping", "illegal dumping", "waste heap",
      "junk", "debris pile", "waste pile", "trash pile", "garbage pile",
      "littering", "fly tipping", "waste disposal", "garbage disposal",
      
      // Bins and collection
      "dustbin", "waste bin", "garbage bin", "overflowing bin", "broken bin",
      "full dustbin", "bin without lid", "collection point", "uncollected garbage",
      "missed collection", "no garbage pickup", "trash can", "waste container",
      "dumpster", "skip", "wheelie bin", "recycling bin", "compost bin",
      "bin collection", "waste collection", "garbage collection", "refuse collection",
      
      // Specific waste types
      "plastic waste", "construction debris", "medical waste", "e-waste",
      "organic waste pile", "burnt waste", "hazardous waste", "toxic waste",
      "food waste", "garden waste", "electronic waste", "battery waste",
      "chemical waste", "industrial waste", "demolition waste", "bulk waste",
      "white goods", "appliance disposal", "furniture dumping",
      
      // Locations and contexts
      "riverbank waste", "railway track garbage", "roadside dumping", "park litter",
      "beach litter", "market waste", "commercial waste", "household waste",
      "street cleaning", "litter picking", "waste segregation", "recycling issue"
    ],
    priority: 1
  },

  "Street Lighting & Electrical": {
    keywords: [
      // Street lights
      "street light", "streetlight", "lamp post", "light pole", "lighting pole",
      "flickering light", "broken light", "dark street", "no street lighting",
      "poor lighting", "nonworking light", "bulb out", "lamp not working",
      "street lamp", "public lighting", "road lighting", "pathway lighting",
      "LED light", "sodium light", "halogen lamp", "fluorescent light",
      "light fixture", "luminaire", "lighting unit", "outdoor lighting",
      
      // Traffic signals
      "traffic light", "traffic signal", "signal failure", "red light not working",
      "green light failure", "broken traffic light", "signal malfunction",
      "traffic control", "pedestrian signal", "crossing signal", "stop light",
      "amber light", "signal timing", "signal box", "traffic controller",
      
      // Power issues
      "power outage", "power cut", "no electricity", "power failure", "voltage fluctuation",
      "blackout", "brownout", "electrical fault", "current failure", "supply failure",
      "electricity problem", "power supply", "electrical supply", "grid failure",
      "load shedding", "power interruption", "electrical outage",
      
      // Wiring and connections
      "exposed wire", "dangling wire", "loose wire", "faulty connection",
      "electrical cable", "overhead wire", "underground cable", "junction box",
      "electrical panel", "distribution box", "wire hanging", "cable fault",
      "insulation failure", "short circuit", "electrical hazard", "live wire",
      
      // Poles and infrastructure
      "electric pole", "utility pole", "fallen pole", "broken pole", "tilted pole",
      "leaning pole", "damaged pole", "telegraph pole", "power line pole",
      "transmission pole", "distribution pole", "pole foundation", "guy wire",
      
      // Transformers and equipment
      "transformer", "damaged transformer", "sparking transformer", "electrical equipment",
      "switchgear", "electrical cabinet", "meter box", "electrical meter",
      "power meter", "junction", "electrical joint", "insulator", "electrical fitting"
    ],
    priority: 2
  },

  "Public Safety & Order": {
    keywords: [
      // Animals
      "stray dog", "animal menace", "dog bite", "stray cattle", "monkey menace",
      "dead animal", "animal carcass", "snake found", "wild animal", "street dog",
      "feral cat", "stray puppy", "rabid animal", "animal attack", "aggressive animal",
      "livestock on road", "cattle menace", "pig menace", "goat on road",
      "animal nuisance", "pet abandonment", "animal control", "animal removal",
      
      // Public nuisance behaviors
      "public nuisance", "open defecation", "public urination", "noise pollution",
      "loud music", "drug abuse", "public intoxication", "loitering", "vagrancy",
      "antisocial behavior", "disturbance", "public disorder", "harassment",
      "begging", "aggressive begging", "panhandling", "soliciting",
      
      // Illegal vendors and encroachment
      "illegal vendor", "unauthorized stall", "street vendor", "hawker",
      "roadside vendor", "pavement vendor", "illegal shop", "unauthorized shop",
      "vendor encroachment", "commercial encroachment", "market encroachment",
      "stall without permit", "unlicensed vendor", "mobile vendor",
      
      // Construction and encroachment
      "illegal construction", "unauthorized construction", "encroachment",
      "building violation", "zoning violation", "unauthorized structure",
      "illegal building", "unpermitted construction", "code violation",
      "setback violation", "height violation", "occupancy violation",
      
      // Signage and advertising violations
      "illegal hoarding", "illegal banner", "unauthorized billboard",
      "illegal advertising", "poster defacement", "wall advertising",
      "unauthorized signage", "banner without permit", "hoarding violation",
      "outdoor advertising violation", "sign violation",
      
      // Vandalism and property damage
      "vandalism", "graffiti", "property damage", "defacement", "wall writing",
      "public property damage", "facility damage", "equipment damage",
      "destruction of property", "malicious damage", "civic property damage",
      
      // Safety hazards
      "unsafe building", "gas leak", "chemical spill", "industrial accident",
      "public safety hazard", "fire hazard", "electrical hazard", "structural hazard",
      "environmental hazard", "toxic exposure", "air pollution", "water contamination",
      "industrial pollution", "factory emission", "chemical leak", "gas escape"
    ],
    priority: 3
  },

  "Other": {
    keywords: [
      // Catch-all terms
      "other", "miscellaneous", "general issue", "undefined", "unclear",
      "mixed issues", "multiple problems", "complex issue", "unclassified",
      
      // Issues that don't fit main categories
      "community center", "park maintenance", "playground", "sports facility",
      "cemetery", "crematorium", "market maintenance", "bus stop",
      "public bench", "statue maintenance", "monument", "public art",
      
      // Administrative issues
      "permit issue", "documentation", "certificate", "license problem",
      "government office", "public service", "information request",
      
      // Special cases requiring manual review
      "flagged content", "inappropriate report", "spam", "test report",
      "duplicate report", "unclear image", "requires review"
    ],
    priority: 4
  }
};

const ALLOWED_MAIN_CATEGORIES = Object.keys(ENHANCED_CATEGORY_DEFINITIONS);

/* ---------------- Config ---------------- */
const MAX_IMAGE_WIDTH = parseInt(process.env.AI_MAX_IMAGE_WIDTH || "1024", 10);
const JPEG_QUALITY = parseInt(process.env.AI_JPEG_QUALITY || "78", 10);
const AXIOS_TIMEOUT = parseInt(process.env.AI_AXIOS_TIMEOUT_MS || "120000", 10);

const IMAGE_WEIGHT = parseFloat(process.env.AI_IMAGE_WEIGHT || "4.0");
const TEXT_WEIGHT = parseFloat(process.env.AI_TEXT_WEIGHT || "1.5");
const VOICE_WEIGHT = parseFloat(process.env.AI_VOICE_WEIGHT || "1.2");
const CONSENSUS_BOOST = parseFloat(process.env.AI_CONSENSUS_BOOST || "0.15");
const IMAGE_MIN_CONFIDENCE = parseFloat(process.env.AI_IMAGE_MIN_CONFIDENCE || "0.6");

/* ---------------- Image processing utils ---------------- */
async function downloadImageBuffer(urlOrPath) {
  if (!urlOrPath) return null;
  try {
    if (/^https?:\/\//i.test(urlOrPath)) {
      const resp = await axios.get(urlOrPath, { responseType: "arraybuffer", timeout: AXIOS_TIMEOUT, maxContentLength: Infinity, maxBodyLength: Infinity });
      return Buffer.from(resp.data);
    } else {
      const abs = path.resolve(urlOrPath);
      if (!fs.existsSync(abs)) return null;
      return fs.readFileSync(abs);
    }
  } catch (err) {
    console.warn("downloadImageBuffer error:", err?.message || err);
    return null;
  }
}

async function processImageBuffer(buffer) {
  if (!buffer) return null;
  try {
    const processed = await sharp(buffer, { failOnError: false })
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return processed;
  } catch (err) {
    console.warn("processImageBuffer error:", err?.message || err);
    return null;
  }
}

async function fetchImageBase64(imageUrlOrPath) {
  try {
    const raw = await downloadImageBuffer(imageUrlOrPath);
    if (!raw) return null;
    const processed = await processImageBuffer(raw);
    const final = processed || raw;
    return final.toString("base64");
  } catch (err) {
    console.warn("fetchImageBase64 error:", err?.message || err);
    return null;
  }
}

/* ---------------- Enhanced fallback classification ---------------- */
function classifyImageByFallback(imageUrlOrPath) {
  // Basic image URL/path analysis for common civic issues
  const urlLower = (imageUrlOrPath || "").toLowerCase();
  
  // Look for keywords in the image URL/path
  const pathKeywords = {
    "Road & Infrastructure": ["road", "pothole", "crack", "bridge", "street", "pavement", "infrastructure"],
    "Water & Sewerage": ["water", "leak", "pipe", "drain", "sewer", "flood", "sewage"],
    "Waste Management": ["garbage", "trash", "waste", "dump", "litter", "bin"],
    "Street Lighting & Electrical": ["light", "lamp", "electric", "power", "pole", "wire"],
    "Public Safety & Order": ["safety", "animal", "dog", "illegal", "vendor", "hazard"]
  };
  
  for (const [category, keywords] of Object.entries(pathKeywords)) {
    for (const keyword of keywords) {
      if (urlLower.includes(keyword)) {
        return {
          subcategory: keyword,
          mainCategory: category,
          confidence: 0.7, // Higher confidence for keyword matches
          source: "path-analysis",
          raw: imageUrlOrPath
        };
      }
    }
  }
  
  // Default fallback for images - assume it's a valid civic issue but unknown type
  return {
    subcategory: "unidentified civic issue",
    mainCategory: "Other",
    confidence: 0.6, // Increased from 0.2 - assume images are relevant civic issues
    source: "default-image-fallback",
    raw: imageUrlOrPath
  };
}

/* ---------------- Enhanced mapping functions ---------------- */
function mapToStandardCategory(aiCategory) {
  if (!aiCategory) return "Other";
  
  const normalized = aiCategory.toLowerCase().trim();
  
  // Direct matches first
  for (const standardCategory of Object.keys(ENHANCED_CATEGORY_DEFINITIONS)) {
    if (normalized === standardCategory.toLowerCase()) {
      return standardCategory;
    }
  }
  
  // Keyword matching
  for (const [standardCategory, config] of Object.entries(ENHANCED_CATEGORY_DEFINITIONS)) {
    for (const keyword of config.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return standardCategory;
      }
    }
  }
  
  // Pattern matching for common variations
  const patterns = {
    "Road & Infrastructure": [
      /road/i, /street/i, /pavement/i, /footpath/i, /sidewalk/i, /bridge/i, 
      /pothole/i, /manhole/i, /infrastructure/i, /construction/i
    ],
    "Water & Sewerage": [
      /water/i, /sewer/i, /drain/i, /pipe/i, /leak/i, /flood/i, /sewage/i, /toilet/i
    ],
    "Waste Management": [
      /garbage/i, /waste/i, /trash/i, /bin/i, /dump/i, /litter/i, /refuse/i
    ],
    "Street Lighting & Electrical": [
      /light/i, /electric/i, /power/i, /lamp/i, /signal/i, /pole/i, /wire/i
    ],
    "Public Safety & Order": [
      /animal/i, /dog/i, /safety/i, /illegal/i, /vendor/i, /nuisance/i, /hazard/i
    ]
  };
  
  for (const [category, regexList] of Object.entries(patterns)) {
    if (regexList.some(regex => regex.test(normalized))) {
      return category;
    }
  }
  
  return "Other";
}

function mapSubToMain(subcategory) {
  return mapToStandardCategory(subcategory);
}

function classifyByKeywords(text = "") {
  const t = (text || "").toLowerCase().trim();
  if (!t) return { subcategory: "other", mainCategory: "Other", confidence: 0.15, raw: text };
  
  let bestMatch = null;
  let maxScore = 0;

  for (const [main, config] of Object.entries(ENHANCED_CATEGORY_DEFINITIONS)) {
    let categoryScore = 0;
    let matchedKeyword = "";
    for (const keyword of config.keywords) {
      if (t.includes(keyword)) {
        const keywordScore = keyword.length / 10;
        if (keywordScore > categoryScore) {
          categoryScore = keywordScore;
          matchedKeyword = keyword;
        }
      }
    }
    if (categoryScore > 0) {
      const priorityWeight = 1 / config.priority;
      const finalScore = categoryScore * priorityWeight;
      if (finalScore > maxScore) {
        maxScore = finalScore;
        bestMatch = {
          subcategory: matchedKeyword,
          mainCategory: main,
          confidence: Math.min(0.9, 0.7 + (finalScore * 0.2)),
          raw: text
        };
      }
    }
  }
  return bestMatch || { subcategory: "other", mainCategory: "Other", confidence: 0.35, raw: text };
}

/* ---------------- JSON parsing ---------------- */
function extractJsonFromText(aiText) {
  if (!aiText) return null;
  let s = String(aiText).trim();
  s = s.replace(/^\s*```[\s\S]*?\n/, "").replace(/```$/, "").trim();
  const firstBraceIdx = s.indexOf("{");
  const lastBraceIdx = s.lastIndexOf("}");
  if (firstBraceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > firstBraceIdx) {
    const jsonText = s.slice(firstBraceIdx, lastBraceIdx + 1);
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      console.warn("JSON parse failed:", e.message);
    }
  }
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function parseCategoryResponse(aiText) {
  const raw = (aiText || "").toString().trim();
  const parsed = extractJsonFromText(raw);
  if (parsed && (parsed.mainCategory || parsed.category || parsed.subcategory)) {
    const sub = parsed.subcategory || parsed.category || "";
    let main = parsed.mainCategory || parsed.main || mapToStandardCategory(sub);
    if (!ALLOWED_MAIN_CATEGORIES.includes(main)) {
      main = mapToStandardCategory(sub);
    }
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    const isPhoto = typeof parsed.isPhoto === "boolean" ? parsed.isPhoto : true;
    const explanation = parsed.explanation || "";
    return { subcategory: sub, mainCategory: main, confidence, isPhoto, explanation, raw };
  }
  const pat = /Category[:\s]*([A-Za-z0-9 _-]+)[,;\s]*Confidence[:\s]*([0-9.]+)/i;
  const m = raw.match(pat);
  if (m) {
    const sub = m[1].trim();
    const conf = parseFloat(m[2]);
    return { subcategory: sub, mainCategory: mapToStandardCategory(sub), confidence: isNaN(conf) ? 0.5 : Math.max(0, Math.min(1, conf)), raw };
  }
  return classifyByKeywords(raw);
}

/* ---------------- Enhanced Prompts ---------------- */
function buildEnhancedImagePrompt() {
  const categoryList = Object.keys(ENHANCED_CATEGORY_DEFINITIONS).join(", ");
  
  return `You are an expert civic infrastructure problem classifier analyzing citizen-reported issues.

TASK: Analyze this image to identify the PRIMARY civic infrastructure problem and classify it into one of these EXACT categories.

AVAILABLE CATEGORIES (choose exactly one):
${categoryList}

CATEGORY DEFINITIONS:
${Object.entries(ENHANCED_CATEGORY_DEFINITIONS).map(([category, def]) => 
  `- ${category}: Issues related to ${def.keywords.slice(0, 10).join(", ")}, etc.`
).join("\n")}

ANALYSIS RULES:
1. This is a REAL PHOTOGRAPH taken by a citizen reporting an infrastructure problem
2. Focus on the MAIN visible problem that dominates the image
3. Choose the MOST APPROPRIATE category from the list above
4. If multiple issues exist, pick the most prominent one
5. Use the EXACT category name from the list

OUTPUT FORMAT (JSON only):
{
  "subcategory": "specific_issue_description",
  "mainCategory": "exact_category_name_from_list",
  "confidence": 0.0-1.0,
  "isPhoto": true,
  "explanation": "brief description focusing on why you chose this category"
}

Be decisive and use only the category names provided above.`;
}

function buildTextPrompt() {
  const categories = ALLOWED_MAIN_CATEGORIES.join(", ");
  return `You are a civic issues text classifier for citizen complaints.
AVAILABLE CATEGORIES: ${categories}
Analyze the text description and classify the civic infrastructure issue being reported.
OUTPUT FORMAT (JSON only):
{
  "subcategory": "specific_issue_name",
  "mainCategory": "one_of_the_main_categories",
  "confidence": 0.0-1.0,
  "explanation": "brief explanation"
}`;
}

/* ---------------- Safety prompt ---------------- */
function buildSafetyPrompt() {
  return `You are a content safety classifier for a civic reporting platform.
TASK: Determine if this image is appropriate for a public civic issue reporting platform.

APPROPRIATE CONTENT:
- Infrastructure problems (roads, lights, utilities)
- Public spaces and facilities
- Civic issues and complaints
- Environmental problems
- Public safety concerns

INAPPROPRIATE CONTENT:
- Nudity or explicit sexual content
- Private spaces (bedrooms, private bathrooms)
- Personal/private photos unrelated to civic issues
- Violence or harassment
- Content clearly not related to civic infrastructure

OUTPUT FORMAT (JSON only):
{
  "isAppropriate": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation if inappropriate, empty if appropriate"
}`;
}

/* ---------------- Gemini analysis ---------------- */
async function analyzeImageWithGemini(imageUrlOrPath) {
  if (!geminiModel) throw new Error("Gemini model not initialized");
  
  const base64 = await fetchImageBase64(imageUrlOrPath);
  if (!base64) {
    console.warn("Failed to fetch/process image for Gemini analysis");
    return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
  }
  
  try {
    const prompt = buildEnhancedImagePrompt();
    console.log("🤖 Sending image to Gemini for analysis...");
    
    const response = await geminiModel.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: base64 } },
      { text: prompt }
    ]);
    
    const aiText = response?.response?.text?.() || "";
    console.log("✅ Gemini Image Response:", aiText.substring(0, 200) + "...");
    
    const result = parseCategoryResponse(aiText);
    if (result.isPhoto === false) {
      result.confidence *= 0.3;
      console.warn("Image classified as non-photo, reducing confidence");
    }
    if (result.mainCategory !== "Other" && result.confidence > IMAGE_MIN_CONFIDENCE) {
      result.confidence = Math.min(1.0, result.confidence + 0.1);
    }
    
    console.log("✅ Gemini analysis successful:", {
      category: result.mainCategory,
      confidence: result.confidence,
      subcategory: result.subcategory
    });
    
    return result;
  } catch (error) {
    console.error("❌ Gemini image analysis failed:", error.message);
    if (error.message?.includes("404") || error.message?.includes("not found")) {
      console.error("🔍 Model not found - API key may not have access to this model version");
    }
    throw error;
  }
}

async function analyzeTextWithGemini(text) {
  if (!geminiModel) throw new Error("Gemini model not initialized");
  const prompt = buildTextPrompt() + "\n\nUser Description: \"" + (text || "").replace(/"/g, '\\"') + "\"";
  try {
    const response = await geminiModel.generateContent([{ text: prompt }]);
    const aiText = response?.response?.text?.() || "";
    return parseCategoryResponse(aiText);
  } catch (error) {
    console.warn("Gemini text analysis failed:", error.message);
    throw error;
  }
}

/* ---------------- Safety analysis ---------------- */
async function checkImageSafety(imageUrlOrPath) {
  if (!geminiModel) return { isAppropriate: true, confidence: 1.0, reason: "" };
  const base64 = await fetchImageBase64(imageUrlOrPath);
  if (!base64) return { isAppropriate: true, confidence: 1.0, reason: "" };
  try {
    const prompt = buildSafetyPrompt();
    const response = await geminiModel.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: base64 } },
      { text: prompt }
    ]);
    const aiText = response?.response?.text?.() || "";
    const parsed = extractJsonFromText(aiText);
    if (parsed && typeof parsed.isAppropriate === "boolean") {
      return { isAppropriate: parsed.isAppropriate, confidence: parsed.confidence || 0.8, reason: parsed.reason || "" };
    }
    return { isAppropriate: true, confidence: 0.5, reason: "" };
  } catch (error) {
    console.warn("Safety check failed:", error.message);
    return { isAppropriate: true, confidence: 0.0, reason: "Safety check failed" };
  }
}

/* ---------------- analyzeFromImage ---------------- */
async function analyzeFromImage(imageUrlOrPath) {
  try {
    if (USE_GEMINI && geminiModel) {
      const safetyCheck = await checkImageSafety(imageUrlOrPath);
      if (!safetyCheck.isAppropriate && safetyCheck.confidence >= 0.8) {
        console.warn("Image failed safety check:", safetyCheck.reason);
        return { subcategory: "", mainCategory: "", confidence: 0, isAppropriate: false, inappropriateReason: safetyCheck.reason, needsReview: true, raw: "" };
      }
      const categoryResult = await analyzeImageWithGemini(imageUrlOrPath);
      return { ...categoryResult, isAppropriate: safetyCheck.isAppropriate, inappropriateReason: safetyCheck.reason, needsReview: !safetyCheck.isAppropriate, safetyConfidence: safetyCheck.confidence };
    }
  } catch (err) {
    console.warn("analyzeFromImage fallback:", err?.message || err);
  }
  
  // Enhanced fallback classification
  const fallbackResult = classifyImageByFallback(imageUrlOrPath);
  return { 
    ...fallbackResult, 
    isAppropriate: true, 
    inappropriateReason: "", 
    needsReview: false 
  };
}

/* ---------------- analyzeFromText ---------------- */
async function analyzeFromText(text) {
  try {
    if (USE_GEMINI && geminiModel) {
      return await analyzeTextWithGemini(text);
    }
  } catch (err) {
    console.warn("analyzeFromText fallback:", err?.message || err);
  }
  return classifyByKeywords(text);
}

/* ---------------- analyzeAll ---------------- */
async function analyzeAll({ image, text, voiceTranscript }) {
  console.log("Starting analysis with:", { hasImage: !!image, hasText: !!text, hasVoice: !!voiceTranscript });
  
  // Run analyses in parallel
  const [imageRes, textRes, voiceRes] = await Promise.all([
    image ? analyzeFromImage(image).catch(err => {
      console.warn("Image analysis failed:", err.message);
      return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
    }) : null,
    text ? analyzeFromText(text).catch(err => {
      console.warn("Text analysis failed:", err.message);
      return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
    }) : null,
    voiceTranscript ? analyzeFromText(voiceTranscript).catch(err => {
      console.warn("Voice analysis failed:", err.message);
      return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
    }) : null
  ]);

  // Create weighted candidates
  const candidates = [];
  if (imageRes) {
    let weight = IMAGE_WEIGHT;
    
    // Reduce weight for non-photos or low confidence
    if (imageRes.isPhoto === false) weight *= 0.2;
    if (imageRes.confidence < IMAGE_MIN_CONFIDENCE) weight *= 0.5;
    
    candidates.push({ 
      ...imageRes, 
      source: "image", 
      weight, 
      main: imageRes.mainCategory || mapToStandardCategory(imageRes.subcategory),
      score: imageRes.confidence * weight
    });
  }
  
  if (textRes) {
    candidates.push({ 
      ...textRes, 
      source: "text", 
      weight: TEXT_WEIGHT, 
      main: textRes.mainCategory || mapToStandardCategory(textRes.subcategory),
      score: textRes.confidence * TEXT_WEIGHT
    });
  }
  
  if (voiceRes) {
    candidates.push({ 
      ...voiceRes, 
      source: "voice", 
      weight: VOICE_WEIGHT, 
      main: voiceRes.mainCategory || mapToStandardCategory(voiceRes.subcategory),
      score: voiceRes.confidence * VOICE_WEIGHT
    });
  }

  // Enhanced best candidate selection
  let best = { main: "Other", confidence: 0, source: "none" };
  if (candidates.length > 0) {
    // Sort by score (confidence * weight)
    candidates.sort((a, b) => b.score - a.score);
    best = candidates[0];
    
    console.log("Candidates ranked by score:", candidates.map(c => ({
      source: c.source,
      category: c.main,
      confidence: c.confidence,
      weight: c.weight,
      score: c.score
    })));
  }

  // Enhanced consensus detection
  const categoryVotes = {};
  for (const c of candidates) {
    const cat = (c.main || "Other").toLowerCase();
    if (!categoryVotes[cat]) {
      categoryVotes[cat] = { count: 0, totalConfidence: 0, sources: [] };
    }
    categoryVotes[cat].count++;
    categoryVotes[cat].totalConfidence += c.confidence;
    categoryVotes[cat].sources.push(c.source);
  }

  let consensus = null;
  let maxVotes = 0;
  for (const [cat, votes] of Object.entries(categoryVotes)) {
    if (votes.count >= 2 && votes.count > maxVotes) {
      maxVotes = votes.count;
      const avgConfidence = votes.totalConfidence / votes.count;
      const candidate = candidates.find(x => (x.main || "").toLowerCase() === cat);
      consensus = {
        mainCategory: candidate?.main || "Other",
        confidence: Math.min(1.0, avgConfidence + CONSENSUS_BOOST),
        sources: votes.sources,
        votes: votes.count
      };
    }
  }

  // Final validation: if image has high confidence, prefer it over consensus
  if (imageRes && imageRes.confidence >= IMAGE_MIN_CONFIDENCE && imageRes.mainCategory !== "Other") {
    console.log("High-confidence image result found, prioritizing image analysis");
    best = candidates.find(c => c.source === "image") || best;
  }

  // Final fallback: use keyword classification on text if available
  if ((!best.main || best.main === "Other") && text) {
    const keywordResult = classifyByKeywords(text);
    if (keywordResult.mainCategory !== "Other") {
      console.log("Using keyword fallback classification");
      best = { 
        ...keywordResult, 
        source: "keyword-fallback",
        confidence: Math.max(best.confidence, keywordResult.confidence * 0.8)
      };
    }
  }

  const result = {
    image: imageRes,
    text: textRes,
    voice: voiceRes,
    best: { 
      mainCategory: best.main || best.mainCategory || "Other", 
      confidence: Math.max(0, Math.min(1, best.confidence || 0)), 
      source: best.source || "none",
      explanation: best.explanation || "",
      raw: best 
    },
    consensus,
    debug: {
      candidates: candidates.map(c => ({
        source: c.source,
        category: c.main,
        confidence: c.confidence,
        score: c.score
      }))
    }
  };

  console.log("🎯 Final analysis result:", {
    category: result.best.mainCategory,
    confidence: result.best.confidence,
    source: result.best.source,
    hasConsensus: !!consensus,
    geminiWorking: !!geminiModel,
    inputTypes: {
      hasImage: !!imageRes,
      hasText: !!textRes,
      hasVoice: !!voiceRes
    }
  });

  return result;
}

/* ---------------- Exports ---------------- */
module.exports = { 
  analyzeFromText, 
  analyzeFromImage, 
  analyzeAll, 
  ENHANCED_CATEGORY_DEFINITIONS, 
  ALLOWED_MAIN_CATEGORIES,
  // Export for testing
  getGeminiStatus: () => ({
    initialized: !!geminiModel,
    useGemini: USE_GEMINI,
    hasApiKey: !!process.env.GEMINI_API_KEY
  })
};








//was fine but
// require('dotenv').config()
// const axios = require('axios')
// const fs = require('fs')
// const path = require('path')
// const sharp = require('sharp')

// let geminiModel = null
// const USE_GEMINI = process.env.USE_GEMINI !== "false" && !!process.env.GEMINI_API_KEY;

// if (USE_GEMINI) {
//   try {
//     const { GoogleGenerativeAI } = require("@google/generative-ai");
//     const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//     geminiModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
//   } catch (e) {
//     console.warn("Gemini init failed — falling back to keyword classifier.", e.message || e);
//     geminiModel = null;
//   }
// }

// /* ---------------- Enhanced Category mapping ---------------- */
// const ENHANCED_CATEGORY_DEFINITIONS = {
//   "Road & Infrastructure": {
//     keywords: [
//       // Road surface issues
//       "pothole", "potholes", "sinkhole", "hole in road", "road crack", "surface crack",
//       "damaged road", "broken road", "uneven surface", "road erosion", "road collapse",
//       "road subsidence", "worn pavement", "rough road", "bumpy road", "crater",
//       "asphalt damage", "concrete crack", "pavement failure", "road deterioration",
//       "surface depression", "road rut", "rutting", "alligator cracking", "edge cracking",
      
//       // Footpath/sidewalk issues  
//       "broken footpath", "damaged sidewalk", "missing tiles", "crack on footpath",
//       "uneven pavement", "trip hazard", "broken kerb", "damaged curb", "walkway damage",
//       "pedestrian path", "footway", "pavement slab", "paving stone", "sidewalk repair",
//       "footpath obstruction", "walkway blocked", "pedestrian safety",
      
//       // Manholes and utilities on roads
//       "manhole cover missing", "open manhole", "sunken manhole", "protruding manhole",
//       "manhole cover displaced", "utility cover missing", "access cover", "drain cover",
//       "inspection chamber", "utility access", "roadway opening", "street opening",
      
//       // Road obstructions and debris
//       "road blockage", "obstruction on road", "fallen tree on road", "road debris",
//       "construction debris on road", "abandoned vehicle", "illegal parking on road",
//       "roadway obstruction", "traffic obstruction", "vehicle breakdown", "cargo spill",
//       "construction equipment", "barricade", "road closure", "lane blocked",
      
//       // Bridge and structural infrastructure
//       "bridge damage", "damaged bridge", "collapsed bridge", "structural failure",
//       "damaged viaduct", "pier damage", "embankment breach", "retaining wall",
//       "guardrail damage", "barrier damage", "overpass", "underpass", "tunnel damage",
//       "infrastructure collapse", "structural crack", "foundation failure",
      
//       // Road markings and signage infrastructure
//       "faded road markings", "missing lane markings", "zebra crossing faded",
//       "road sign damaged", "signpost bent", "traffic sign missing", "road paint",
//       "lane divider", "center line", "edge line", "crosswalk marking"
//     ],
//     priority: 1
//   },

//   "Water & Sewerage": {
//     keywords: [
//       // Water leaks and bursts
//       "water leak", "burst pipe", "pipe leak", "water main break", "pipeline leak",
//       "pipeline burst", "water overflow", "flooding", "water logging", "standing water",
//       "burst water main", "water gushing", "water spray", "pipe rupture", "water wastage",
//       "supply line break", "distribution pipe", "service line", "water main", "hydrant leak",
//       "valve leak", "meter leak", "connection leak", "joint failure", "pipe failure",
      
//       // Sewage issues
//       "sewage leak", "sewer leak", "raw sewage", "sewage overflow", "sewer blockage",
//       "clogged sewer", "sewerage", "sewer line", "sewage line", "toilet overflow",
//       "septic overflow", "waste water", "effluent", "sewage backup", "sewer backup",
//       "manhole sewage", "sewage smell", "sewage on road", "sewage in drain",
      
//       // Drainage problems
//       "drain", "blocked drain", "clogged drain", "choked drain", "overflowing drain",
//       "open drain", "damaged drain", "drain collapse", "garbage in drain",
//       "drain cover missing", "drainage blockage", "waterlogged area", "storm drain",
//       "surface drainage", "roadside drain", "kerb drain", "gutter", "channel",
//       "culvert", "inlet blocked", "outlet blocked", "drainage pipe", "catch basin",
//       "stormwater", "rainwater drainage", "surface water", "puddle", "water accumulation",
      
//       // Sanitation facilities
//       "public toilet", "unclean public toilet", "dirty urinal", "filthy restroom",
//       "toilet block", "sanitation", "public health hazard", "foul smell", "bad odour",
//       "restroom", "washroom", "lavatory", "public convenience", "comfort station",
//       "toilet facility", "sanitary facility", "hygiene issue", "cleaning required"
//     ],
//     priority: 1
//   },

//   "Waste Management": {
//     keywords: [
//       // General waste
//       "garbage", "trash", "rubbish", "refuse", "debris", "waste", "litter",
//       "scattered waste", "dump", "dumping", "illegal dumping", "waste heap",
//       "junk", "debris pile", "waste pile", "trash pile", "garbage pile",
//       "littering", "fly tipping", "waste disposal", "garbage disposal",
      
//       // Bins and collection
//       "dustbin", "waste bin", "garbage bin", "overflowing bin", "broken bin",
//       "full dustbin", "bin without lid", "collection point", "uncollected garbage",
//       "missed collection", "no garbage pickup", "trash can", "waste container",
//       "dumpster", "skip", "wheelie bin", "recycling bin", "compost bin",
//       "bin collection", "waste collection", "garbage collection", "refuse collection",
      
//       // Specific waste types
//       "plastic waste", "construction debris", "medical waste", "e-waste",
//       "organic waste pile", "burnt waste", "hazardous waste", "toxic waste",
//       "food waste", "garden waste", "electronic waste", "battery waste",
//       "chemical waste", "industrial waste", "demolition waste", "bulk waste",
//       "white goods", "appliance disposal", "furniture dumping",
      
//       // Locations and contexts
//       "riverbank waste", "railway track garbage", "roadside dumping", "park litter",
//       "beach litter", "market waste", "commercial waste", "household waste",
//       "street cleaning", "litter picking", "waste segregation", "recycling issue"
//     ],
//     priority: 1
//   },

//   "Street Lighting & Electrical": {
//     keywords: [
//       // Street lights
//       "street light", "streetlight", "lamp post", "light pole", "lighting pole",
//       "flickering light", "broken light", "dark street", "no street lighting",
//       "poor lighting", "nonworking light", "bulb out", "lamp not working",
//       "street lamp", "public lighting", "road lighting", "pathway lighting",
//       "LED light", "sodium light", "halogen lamp", "fluorescent light",
//       "light fixture", "luminaire", "lighting unit", "outdoor lighting",
      
//       // Traffic signals
//       "traffic light", "traffic signal", "signal failure", "red light not working",
//       "green light failure", "broken traffic light", "signal malfunction",
//       "traffic control", "pedestrian signal", "crossing signal", "stop light",
//       "amber light", "signal timing", "signal box", "traffic controller",
      
//       // Power issues
//       "power outage", "power cut", "no electricity", "power failure", "voltage fluctuation",
//       "blackout", "brownout", "electrical fault", "current failure", "supply failure",
//       "electricity problem", "power supply", "electrical supply", "grid failure",
//       "load shedding", "power interruption", "electrical outage",
      
//       // Wiring and connections
//       "exposed wire", "dangling wire", "loose wire", "faulty connection",
//       "electrical cable", "overhead wire", "underground cable", "junction box",
//       "electrical panel", "distribution box", "wire hanging", "cable fault",
//       "insulation failure", "short circuit", "electrical hazard", "live wire",
      
//       // Poles and infrastructure
//       "electric pole", "utility pole", "fallen pole", "broken pole", "tilted pole",
//       "leaning pole", "damaged pole", "telegraph pole", "power line pole",
//       "transmission pole", "distribution pole", "pole foundation", "guy wire",
      
//       // Transformers and equipment
//       "transformer", "damaged transformer", "sparking transformer", "electrical equipment",
//       "switchgear", "electrical cabinet", "meter box", "electrical meter",
//       "power meter", "junction", "electrical joint", "insulator", "electrical fitting"
//     ],
//     priority: 2
//   },

//   "Public Safety & Order": {
//     keywords: [
//       // Animals
//       "stray dog", "animal menace", "dog bite", "stray cattle", "monkey menace",
//       "dead animal", "animal carcass", "snake found", "wild animal", "street dog",
//       "feral cat", "stray puppy", "rabid animal", "animal attack", "aggressive animal",
//       "livestock on road", "cattle menace", "pig menace", "goat on road",
//       "animal nuisance", "pet abandonment", "animal control", "animal removal",
      
//       // Public nuisance behaviors
//       "public nuisance", "open defecation", "public urination", "noise pollution",
//       "loud music", "drug abuse", "public intoxication", "loitering", "vagrancy",
//       "antisocial behavior", "disturbance", "public disorder", "harassment",
//       "begging", "aggressive begging", "panhandling", "soliciting",
      
//       // Illegal vendors and encroachment
//       "illegal vendor", "unauthorized stall", "street vendor", "hawker",
//       "roadside vendor", "pavement vendor", "illegal shop", "unauthorized shop",
//       "vendor encroachment", "commercial encroachment", "market encroachment",
//       "stall without permit", "unlicensed vendor", "mobile vendor",
      
//       // Construction and encroachment
//       "illegal construction", "unauthorized construction", "encroachment",
//       "building violation", "zoning violation", "unauthorized structure",
//       "illegal building", "unpermitted construction", "code violation",
//       "setback violation", "height violation", "occupancy violation",
      
//       // Signage and advertising violations
//       "illegal hoarding", "illegal banner", "unauthorized billboard",
//       "illegal advertising", "poster defacement", "wall advertising",
//       "unauthorized signage", "banner without permit", "hoarding violation",
//       "outdoor advertising violation", "sign violation",
      
//       // Vandalism and property damage
//       "vandalism", "graffiti", "property damage", "defacement", "wall writing",
//       "public property damage", "facility damage", "equipment damage",
//       "destruction of property", "malicious damage", "civic property damage",
      
//       // Safety hazards
//       "unsafe building", "gas leak", "chemical spill", "industrial accident",
//       "public safety hazard", "fire hazard", "electrical hazard", "structural hazard",
//       "environmental hazard", "toxic exposure", "air pollution", "water contamination",
//       "industrial pollution", "factory emission", "chemical leak", "gas escape"
//     ],
//     priority: 3
//   },

//   "Other": {
//     keywords: [
//       // Catch-all terms
//       "other", "miscellaneous", "general issue", "undefined", "unclear",
//       "mixed issues", "multiple problems", "complex issue", "unclassified",
      
//       // Issues that don't fit main categories
//       "community center", "park maintenance", "playground", "sports facility",
//       "cemetery", "crematorium", "market maintenance", "bus stop",
//       "public bench", "statue maintenance", "monument", "public art",
      
//       // Administrative issues
//       "permit issue", "documentation", "certificate", "license problem",
//       "government office", "public service", "information request",
      
//       // Special cases requiring manual review
//       "flagged content", "inappropriate report", "spam", "test report",
//       "duplicate report", "unclear image", "requires review"
//     ],
//     priority: 4
//   }
// };

// const ALLOWED_MAIN_CATEGORIES = Object.keys(ENHANCED_CATEGORY_DEFINITIONS);

// /* ---------------- Config ---------------- */
// const MAX_IMAGE_WIDTH = parseInt(process.env.AI_MAX_IMAGE_WIDTH || "1024", 10);
// const JPEG_QUALITY = parseInt(process.env.AI_JPEG_QUALITY || "78", 10);
// const AXIOS_TIMEOUT = parseInt(process.env.AI_AXIOS_TIMEOUT_MS || "120000", 10);

// const IMAGE_WEIGHT = parseFloat(process.env.AI_IMAGE_WEIGHT || "4.0");
// const TEXT_WEIGHT = parseFloat(process.env.AI_TEXT_WEIGHT || "1.5");
// const VOICE_WEIGHT = parseFloat(process.env.AI_VOICE_WEIGHT || "1.2");
// const CONSENSUS_BOOST = parseFloat(process.env.AI_CONSENSUS_BOOST || "0.15");
// const IMAGE_MIN_CONFIDENCE = parseFloat(process.env.AI_IMAGE_MIN_CONFIDENCE || "0.6");

// /* ---------------- Image processing utils ---------------- */
// async function downloadImageBuffer(urlOrPath) {
//   if (!urlOrPath) return null;
//   try {
//     if (/^https?:\/\//i.test(urlOrPath)) {
//       const resp = await axios.get(urlOrPath, { responseType: "arraybuffer", timeout: AXIOS_TIMEOUT, maxContentLength: Infinity, maxBodyLength: Infinity });
//       return Buffer.from(resp.data);
//     } else {
//       const abs = path.resolve(urlOrPath);
//       if (!fs.existsSync(abs)) return null;
//       return fs.readFileSync(abs);
//     }
//   } catch (err) {
//     console.warn("downloadImageBuffer error:", err?.message || err);
//     return null;
//   }
// }

// async function processImageBuffer(buffer) {
//   if (!buffer) return null;
//   try {
//     const processed = await sharp(buffer, { failOnError: false })
//       .rotate()
//       .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
//       .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
//       .toBuffer();
//     return processed;
//   } catch (err) {
//     console.warn("processImageBuffer error:", err?.message || err);
//     return null;
//   }
// }

// async function fetchImageBase64(imageUrlOrPath) {
//   try {
//     const raw = await downloadImageBuffer(imageUrlOrPath);
//     if (!raw) return null;
//     const processed = await processImageBuffer(raw);
//     const final = processed || raw;
//     return final.toString("base64");
//   } catch (err) {
//     console.warn("fetchImageBase64 error:", err?.message || err);
//     return null;
//   }
// }

// /* ---------------- Enhanced mapping functions ---------------- */
// function mapToStandardCategory(aiCategory) {
//   if (!aiCategory) return "Public Safety & Order";
  
//   const normalized = aiCategory.toLowerCase().trim();
  
//   // Direct matches first
//   for (const standardCategory of Object.keys(ENHANCED_CATEGORY_DEFINITIONS)) {
//     if (normalized === standardCategory.toLowerCase()) {
//       return standardCategory;
//     }
//   }
  
//   // Keyword matching
//   for (const [standardCategory, config] of Object.entries(ENHANCED_CATEGORY_DEFINITIONS)) {
//     for (const keyword of config.keywords) {
//       if (normalized.includes(keyword.toLowerCase())) {
//         return standardCategory;
//       }
//     }
//   }
  
//   // Pattern matching for common variations
//   const patterns = {
//     "Road & Infrastructure": [
//       /road/i, /street/i, /pavement/i, /footpath/i, /sidewalk/i, /bridge/i, 
//       /pothole/i, /manhole/i, /infrastructure/i, /construction/i
//     ],
//     "Water & Sewerage": [
//       /water/i, /sewer/i, /drain/i, /pipe/i, /leak/i, /flood/i, /sewage/i, /toilet/i
//     ],
//     "Waste Management": [
//       /garbage/i, /waste/i, /trash/i, /bin/i, /dump/i, /litter/i, /refuse/i
//     ],
//     "Street Lighting & Electrical": [
//       /light/i, /electric/i, /power/i, /lamp/i, /signal/i, /pole/i, /wire/i
//     ],
//     "Public Safety & Order": [
//       /animal/i, /dog/i, /safety/i, /illegal/i, /vendor/i, /nuisance/i, /hazard/i
//     ]
//   };
  
//   for (const [category, regexList] of Object.entries(patterns)) {
//     if (regexList.some(regex => regex.test(normalized))) {
//       return category;
//     }
//   }
  
//   return "Public Safety & Order"; // Final fallback
// }

// function mapSubToMain(subcategory) {
//   return mapToStandardCategory(subcategory);
// }

// function classifyByKeywords(text = "") {
//   const t = (text || "").toLowerCase().trim();
//   if (!t) return { subcategory: "other", mainCategory: "Public Safety & Order", confidence: 0.15, raw: text };
  
//   let bestMatch = null;
//   let maxScore = 0;

//   for (const [main, config] of Object.entries(ENHANCED_CATEGORY_DEFINITIONS)) {
//     let categoryScore = 0;
//     let matchedKeyword = "";
//     for (const keyword of config.keywords) {
//       if (t.includes(keyword)) {
//         const keywordScore = keyword.length / 10;
//         if (keywordScore > categoryScore) {
//           categoryScore = keywordScore;
//           matchedKeyword = keyword;
//         }
//       }
//     }
//     if (categoryScore > 0) {
//       const priorityWeight = 1 / config.priority;
//       const finalScore = categoryScore * priorityWeight;
//       if (finalScore > maxScore) {
//         maxScore = finalScore;
//         bestMatch = {
//           subcategory: matchedKeyword,
//           mainCategory: main,
//           confidence: Math.min(0.9, 0.7 + (finalScore * 0.2)),
//           raw: text
//         };
//       }
//     }
//   }
//   return bestMatch || { subcategory: "other", mainCategory: "Public Safety & Order", confidence: 0.35, raw: text };
// }

// /* ---------------- JSON parsing ---------------- */
// function extractJsonFromText(aiText) {
//   if (!aiText) return null;
//   let s = String(aiText).trim();
//   s = s.replace(/^\s*```[\s\S]*?\n/, "").replace(/```$/, "").trim();
//   const firstBraceIdx = s.indexOf("{");
//   const lastBraceIdx = s.lastIndexOf("}");
//   if (firstBraceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > firstBraceIdx) {
//     const jsonText = s.slice(firstBraceIdx, lastBraceIdx + 1);
//     try {
//       return JSON.parse(jsonText);
//     } catch (e) {
//       console.warn("JSON parse failed:", e.message);
//     }
//   }
//   try {
//     return JSON.parse(s);
//   } catch (e) {
//     return null;
//   }
// }

// function parseCategoryResponse(aiText) {
//   const raw = (aiText || "").toString().trim();
//   const parsed = extractJsonFromText(raw);
//   if (parsed && (parsed.mainCategory || parsed.category || parsed.subcategory)) {
//     const sub = parsed.subcategory || parsed.category || "";
//     let main = parsed.mainCategory || parsed.main || mapToStandardCategory(sub);
//     if (!ALLOWED_MAIN_CATEGORIES.includes(main)) {
//       main = mapToStandardCategory(sub);
//     }
//     const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
//     const isPhoto = typeof parsed.isPhoto === "boolean" ? parsed.isPhoto : true;
//     const explanation = parsed.explanation || "";
//     return { subcategory: sub, mainCategory: main, confidence, isPhoto, explanation, raw };
//   }
//   const pat = /Category[:\s]*([A-Za-z0-9 _-]+)[,;\s]*Confidence[:\s]*([0-9.]+)/i;
//   const m = raw.match(pat);
//   if (m) {
//     const sub = m[1].trim();
//     const conf = parseFloat(m[2]);
//     return { subcategory: sub, mainCategory: mapToStandardCategory(sub), confidence: isNaN(conf) ? 0.5 : Math.max(0, Math.min(1, conf)), raw };
//   }
//   return classifyByKeywords(raw);
// }

// /* ---------------- Enhanced Prompts ---------------- */
// function buildEnhancedImagePrompt() {
//   const categoryList = Object.keys(ENHANCED_CATEGORY_DEFINITIONS).join(", ");
  
//   return `You are an expert civic infrastructure problem classifier analyzing citizen-reported issues.

// TASK: Analyze this image to identify the PRIMARY civic infrastructure problem and classify it into one of these EXACT categories.

// AVAILABLE CATEGORIES (choose exactly one):
// ${categoryList}

// CATEGORY DEFINITIONS:
// ${Object.entries(ENHANCED_CATEGORY_DEFINITIONS).map(([category, def]) => 
//   `- ${category}: Issues related to ${def.keywords.slice(0, 10).join(", ")}, etc.`
// ).join("\n")}

// ANALYSIS RULES:
// 1. This is a REAL PHOTOGRAPH taken by a citizen reporting an infrastructure problem
// 2. Focus on the MAIN visible problem that dominates the image
// 3. Choose the MOST APPROPRIATE category from the list above
// 4. If multiple issues exist, pick the most prominent one
// 5. Use the EXACT category name from the list

// OUTPUT FORMAT (JSON only):
// {
//   "subcategory": "specific_issue_description",
//   "mainCategory": "exact_category_name_from_list",
//   "confidence": 0.0-1.0,
//   "isPhoto": true,
//   "explanation": "brief description focusing on why you chose this category"
// }

// Be decisive and use only the category names provided above.`;
// }

// function buildTextPrompt() {
//   const categories = ALLOWED_MAIN_CATEGORIES.join(", ");
//   return `You are a civic issues text classifier for citizen complaints.
// AVAILABLE CATEGORIES: ${categories}
// Analyze the text description and classify the civic infrastructure issue being reported.
// OUTPUT FORMAT (JSON only):
// {
//   "subcategory": "specific_issue_name",
//   "mainCategory": "one_of_the_main_categories",
//   "confidence": 0.0-1.0,
//   "explanation": "brief explanation"
// }`;
// }

// /* ---------------- Safety prompt ---------------- */
// function buildSafetyPrompt() {
//   return `You are a content safety classifier for a civic reporting platform.
// TASK: Determine if this image is appropriate for a public civic issue reporting platform.

// APPROPRIATE CONTENT:
// - Infrastructure problems (roads, lights, utilities)
// - Public spaces and facilities
// - Civic issues and complaints
// - Environmental problems
// - Public safety concerns

// INAPPROPRIATE CONTENT:
// - Nudity or explicit sexual content
// - Private spaces (bedrooms, private bathrooms)
// - Personal/private photos unrelated to civic issues
// - Violence or harassment
// - Content clearly not related to civic infrastructure

// OUTPUT FORMAT (JSON only):
// {
//   "isAppropriate": true/false,
//   "confidence": 0.0-1.0,
//   "reason": "brief explanation if inappropriate, empty if appropriate"
// }`;
// }

// /* ---------------- Gemini analysis ---------------- */
// async function analyzeImageWithGemini(imageUrlOrPath) {
//   if (!geminiModel) throw new Error("Gemini model not initialized");
//   const base64 = await fetchImageBase64(imageUrlOrPath);
//   if (!base64) return { subcategory: "other", mainCategory: "Public Safety & Order", confidence: 0.0, raw: "" };
//   try {
//     const prompt = buildEnhancedImagePrompt();
//     const response = await geminiModel.generateContent([
//       { inlineData: { mimeType: "image/jpeg", data: base64 } },
//       { text: prompt }
//     ]);
//     const aiText = response?.response?.text?.() || "";
//     const result = parseCategoryResponse(aiText);
//     if (result.isPhoto === false) {
//       result.confidence *= 0.3;
//       console.warn("Image classified as non-photo, reducing confidence");
//     }
//     if (result.mainCategory !== "Public Safety & Order" && result.confidence > IMAGE_MIN_CONFIDENCE) {
//       result.confidence = Math.min(1.0, result.confidence + 0.1);
//     }
//     return result;
//   } catch (error) {
//     console.warn("Gemini image analysis failed:", error.message);
//     throw error;
//   }
// }

// async function analyzeTextWithGemini(text) {
//   if (!geminiModel) throw new Error("Gemini model not initialized");
//   const prompt = buildTextPrompt() + "\n\nUser Description: \"" + (text || "").replace(/"/g, '\\"') + "\"";
//   try {
//     const response = await geminiModel.generateContent([{ text: prompt }]);
//     const aiText = response?.response?.text?.() || "";
//     return parseCategoryResponse(aiText);
//   } catch (error) {
//     console.warn("Gemini text analysis failed:", error.message);
//     throw error;
//   }
// }

// /* ---------------- Safety analysis ---------------- */
// async function checkImageSafety(imageUrlOrPath) {
//   if (!geminiModel) return { isAppropriate: true, confidence: 1.0, reason: "" };
//   const base64 = await fetchImageBase64(imageUrlOrPath);
//   if (!base64) return { isAppropriate: true, confidence: 1.0, reason: "" };
//   try {
//     const prompt = buildSafetyPrompt();
//     const response = await geminiModel.generateContent([
//       { inlineData: { mimeType: "image/jpeg", data: base64 } },
//       { text: prompt }
//     ]);
//     const aiText = response?.response?.text?.() || "";
//     const parsed = extractJsonFromText(aiText);
//     if (parsed && typeof parsed.isAppropriate === "boolean") {
//       return { isAppropriate: parsed.isAppropriate, confidence: parsed.confidence || 0.8, reason: parsed.reason || "" };
//     }
//     return { isAppropriate: true, confidence: 0.5, reason: "" };
//   } catch (error) {
//     console.warn("Safety check failed:", error.message);
//     return { isAppropriate: true, confidence: 0.0, reason: "Safety check failed" };
//   }
// }

// /* ---------------- UPDATED analyzeFromImage ---------------- */
// async function analyzeFromImage(imageUrlOrPath) {
//   try {
//     if (USE_GEMINI && geminiModel) {
//       const safetyCheck = await checkImageSafety(imageUrlOrPath);
//       if (!safetyCheck.isAppropriate && safetyCheck.confidence >= 0.8) {
//         console.warn("Image failed safety check:", safetyCheck.reason);
//         return { subcategory: "", mainCategory: "", confidence: 0, isAppropriate: false, inappropriateReason: safetyCheck.reason, needsReview: true, raw: "" };
//       }
//       const categoryResult = await analyzeImageWithGemini(imageUrlOrPath);
//       return { ...categoryResult, isAppropriate: safetyCheck.isAppropriate, inappropriateReason: safetyCheck.reason, needsReview: !safetyCheck.isAppropriate, safetyConfidence: safetyCheck.confidence };
//     }
//   } catch (err) {
//     console.warn("analyzeFromImage fallback:", err?.message || err);
//   }
//   return { subcategory: "other", mainCategory: "Public Safety & Order", confidence: 0.2, raw: "", isAppropriate: true, inappropriateReason: "", needsReview: false };
// }

// /* ---------------- analyzeFromText ---------------- */
// async function analyzeFromText(text) {
//   try {
//     if (USE_GEMINI && geminiModel) {
//       return await analyzeTextWithGemini(text);
//     }
//   } catch (err) {
//     console.warn("analyzeFromText fallback:", err?.message || err);
//   }
//   return classifyByKeywords(text);
// }

// /* ---------------- analyzeAll (unchanged) ---------------- */
// async function analyzeAll({ image, text, voiceTranscript }) {
//   console.log("Starting analysis with:", { hasImage: !!image, hasText: !!text, hasVoice: !!voiceTranscript });
  
//   // Run analyses in parallel
//   const [imageRes, textRes, voiceRes] = await Promise.all([
//     image ? analyzeFromImage(image).catch(err => {
//       console.warn("Image analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Public Safety & Order", confidence: 0.0, raw: "" };
//     }) : null,
//     text ? analyzeFromText(text).catch(err => {
//       console.warn("Text analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Public Safety & Order", confidence: 0.0, raw: "" };
//     }) : null,
//     voiceTranscript ? analyzeFromText(voiceTranscript).catch(err => {
//       console.warn("Voice analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Public Safety & Order", confidence: 0.0, raw: "" };
//     }) : null
//   ]);

//   // Create weighted candidates
//   const candidates = [];
//   if (imageRes) {
//     let weight = IMAGE_WEIGHT;
    
//     // Reduce weight for non-photos or low confidence
//     if (imageRes.isPhoto === false) weight *= 0.2;
//     if (imageRes.confidence < IMAGE_MIN_CONFIDENCE) weight *= 0.5;
    
//     candidates.push({ 
//       ...imageRes, 
//       source: "image", 
//       weight, 
//       main: imageRes.mainCategory || mapToStandardCategory(imageRes.subcategory),
//       score: imageRes.confidence * weight
//     });
//   }
  
//   if (textRes) {
//     candidates.push({ 
//       ...textRes, 
//       source: "text", 
//       weight: TEXT_WEIGHT, 
//       main: textRes.mainCategory || mapToStandardCategory(textRes.subcategory),
//       score: textRes.confidence * TEXT_WEIGHT
//     });
//   }
  
//   if (voiceRes) {
//     candidates.push({ 
//       ...voiceRes, 
//       source: "voice", 
//       weight: VOICE_WEIGHT, 
//       main: voiceRes.mainCategory || mapToStandardCategory(voiceRes.subcategory),
//       score: voiceRes.confidence * VOICE_WEIGHT
//     });
//   }

//   // Enhanced best candidate selection
//   let best = { main: "Public Safety & Order", confidence: 0, source: "none" };
//   if (candidates.length > 0) {
//     // Sort by score (confidence * weight)
//     candidates.sort((a, b) => b.score - a.score);
//     best = candidates[0];
    
//     console.log("Candidates ranked by score:", candidates.map(c => ({
//       source: c.source,
//       category: c.main,
//       confidence: c.confidence,
//       weight: c.weight,
//       score: c.score
//     })));
//   }

//   // Enhanced consensus detection
//   const categoryVotes = {};
//   for (const c of candidates) {
//     const cat = (c.main || "Public Safety & Order").toLowerCase();
//     if (!categoryVotes[cat]) {
//       categoryVotes[cat] = { count: 0, totalConfidence: 0, sources: [] };
//     }
//     categoryVotes[cat].count++;
//     categoryVotes[cat].totalConfidence += c.confidence;
//     categoryVotes[cat].sources.push(c.source);
//   }

//   let consensus = null;
//   let maxVotes = 0;
//   for (const [cat, votes] of Object.entries(categoryVotes)) {
//     if (votes.count >= 2 && votes.count > maxVotes) {
//       maxVotes = votes.count;
//       const avgConfidence = votes.totalConfidence / votes.count;
//       const candidate = candidates.find(x => (x.main || "").toLowerCase() === cat);
//       consensus = {
//         mainCategory: candidate?.main || "Public Safety & Order",
//         confidence: Math.min(1.0, avgConfidence + CONSENSUS_BOOST),
//         sources: votes.sources,
//         votes: votes.count
//       };
//     }
//   }

//   // Final validation: if image has high confidence, prefer it over consensus
//   if (imageRes && imageRes.confidence >= IMAGE_MIN_CONFIDENCE && imageRes.mainCategory !== "Public Safety & Order") {
//     console.log("High-confidence image result found, prioritizing image analysis");
//     best = candidates.find(c => c.source === "image") || best;
//   }

//   // Final fallback: use keyword classification on text if available
//   if ((!best.main || best.main === "Public Safety & Order") && text) {
//     const keywordResult = classifyByKeywords(text);
//     if (keywordResult.mainCategory !== "Public Safety & Order") {
//       console.log("Using keyword fallback classification");
//       best = { 
//         ...keywordResult, 
//         source: "keyword-fallback",
//         confidence: Math.max(best.confidence, keywordResult.confidence * 0.8)
//       };
//     }
//   }

//   const result = {
//     image: imageRes,
//     text: textRes,
//     voice: voiceRes,
//     best: { 
//       mainCategory: best.main || best.mainCategory || "Public Safety & Order", 
//       confidence: Math.max(0, Math.min(1, best.confidence || 0)), 
//       source: best.source || "none",
//       explanation: best.explanation || "",
//       raw: best 
//     },
//     consensus,
//     debug: {
//       candidates: candidates.map(c => ({
//         source: c.source,
//         category: c.main,
//         confidence: c.confidence,
//         score: c.score
//       }))
//     }
//   };

//   console.log("Final analysis result:", {
//     best: result.best.mainCategory,
//     confidence: result.best.confidence,
//     source: result.best.source,
//     hasConsensus: !!consensus
//   });

//   return result;
// }

// /* ---------------- Exports ---------------- */
// module.exports = { analyzeFromText, analyzeFromImage, analyzeAll, ENHANCED_CATEGORY_DEFINITIONS, ALLOWED_MAIN_CATEGORIES };
















///working fine latest 2nd
require('dotenv').config()
// const axios = require('axios')
// const fs = require('fs')
// const path = require('path')
// const sharp = require('sharp')

// let geminiModel = null
// const USE_GEMINI = process.env.USE_GEMINI !== "false" && !!process.env.GEMINI_API_KEY;

// if (USE_GEMINI) {
//   try {
//     const { GoogleGenerativeAI } = require("@google/generative-ai");
//     const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//     geminiModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
//   } catch (e) {
//     console.warn("Gemini init failed — falling back to keyword classifier.", e.message || e);
//     geminiModel = null;
//   }
// }

// /* ---------------- Category mapping ---------------- */
// const CATEGORY_MAP = {
//   "Garbage": { keywords: ["garbage", "trash", "litter", "dump", "rubbish", "waste", "dumping", "open dump", "garbage pile", "refuse", "debris", "scattered waste", "littering", "garbage collection"], priority: 1 },
//   "Road Issues": { keywords: ["pothole", "sinkhole", "broken road", "road damage", "cracked road", "road collapse", "road erosion", "broken footpath", "missing slab", "uneven surface", "road blockage", "road subsidence", "manhole cover missing", "damaged curb", "pavement damage", "street repair"], priority: 2 },
//   "Street Light Issue": { keywords: ["streetlight", "lamp", "light not working", "lamp post", "street light", "light pole", "bulb out", "flickering light", "electric pole light", "broken light", "dark street", "lighting problem"], priority: 3 },
//   "Water Leakage": { keywords: ["leak", "water leak", "burst pipe", "pipe leak", "sewage leak", "water overflow", "manhole overflow", "drainage leak", "flooding", "water logging", "broken pipe", "water wastage"], priority: 2 },
//   "Illegal Construction": { keywords: ["illegal construction", "unauthorized construction", "encroachment", "unauthorized building", "makeshift structure", "illegal building", "blocking road", "unauthorized structure"], priority: 3 },
//   "Sanitation": { keywords: ["toilet", "sewage", "sewage overflow", "open drain", "open defecation", "toilet block", "sanitation", "septic", "sewage smell", "drainage", "clogged drain", "dirty water"], priority: 2 },
//   "Traffic Signage": { keywords: ["signage", "traffic sign", "road sign missing", "traffic signal", "stop sign missing", "sign damaged", "road sign", "traffic light broken", "signal not working"], priority: 3 },
//   "Other": { keywords: ["other", "miscellaneous", "general issue"], priority: 4 }
// };

// const ALLOWED_MAIN_CATEGORIES = Object.keys(CATEGORY_MAP);

// /* ---------------- Config ---------------- */
// const MAX_IMAGE_WIDTH = parseInt(process.env.AI_MAX_IMAGE_WIDTH || "1024", 10);
// const JPEG_QUALITY = parseInt(process.env.AI_JPEG_QUALITY || "78", 10);
// const AXIOS_TIMEOUT = parseInt(process.env.AI_AXIOS_TIMEOUT_MS || "120000", 10);

// const IMAGE_WEIGHT = parseFloat(process.env.AI_IMAGE_WEIGHT || "4.0");
// const TEXT_WEIGHT = parseFloat(process.env.AI_TEXT_WEIGHT || "1.5");
// const VOICE_WEIGHT = parseFloat(process.env.AI_VOICE_WEIGHT || "1.2");
// const CONSENSUS_BOOST = parseFloat(process.env.AI_CONSENSUS_BOOST || "0.15");
// const IMAGE_MIN_CONFIDENCE = parseFloat(process.env.AI_IMAGE_MIN_CONFIDENCE || "0.6");

// /* ---------------- Image processing utils ---------------- */
// async function downloadImageBuffer(urlOrPath) {
//   if (!urlOrPath) return null;
//   try {
//     if (/^https?:\/\//i.test(urlOrPath)) {
//       const resp = await axios.get(urlOrPath, { responseType: "arraybuffer", timeout: AXIOS_TIMEOUT, maxContentLength: Infinity, maxBodyLength: Infinity });
//       return Buffer.from(resp.data);
//     } else {
//       const abs = path.resolve(urlOrPath);
//       if (!fs.existsSync(abs)) return null;
//       return fs.readFileSync(abs);
//     }
//   } catch (err) {
//     console.warn("downloadImageBuffer error:", err?.message || err);
//     return null;
//   }
// }

// async function processImageBuffer(buffer) {
//   if (!buffer) return null;
//   try {
//     const processed = await sharp(buffer, { failOnError: false })
//       .rotate()
//       .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
//       .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
//       .toBuffer();
//     return processed;
//   } catch (err) {
//     console.warn("processImageBuffer error:", err?.message || err);
//     return null;
//   }
// }

// async function fetchImageBase64(imageUrlOrPath) {
//   try {
//     const raw = await downloadImageBuffer(imageUrlOrPath);
//     if (!raw) return null;
//     const processed = await processImageBuffer(raw);
//     const final = processed || raw;
//     return final.toString("base64");
//   } catch (err) {
//     console.warn("fetchImageBase64 error:", err?.message || err);
//     return null;
//   }
// }

// /* ---------------- Keyword classifier ---------------- */
// function mapSubToMain(subcategory) {
//   if (!subcategory) return "Other";
//   const t = subcategory.toLowerCase();
//   for (const [main, config] of Object.entries(CATEGORY_MAP)) {
//     for (const keyword of config.keywords) {
//       if (t.includes(keyword)) return main;
//     }
//   }
//   return "Other";
// }

// function classifyByKeywords(text = "") {
//   const t = (text || "").toLowerCase().trim();
//   if (!t) return { subcategory: "other", mainCategory: "Other", confidence: 0.15, raw: text };
//   let bestMatch = null;
//   let maxScore = 0;

//   for (const [main, config] of Object.entries(CATEGORY_MAP)) {
//     let categoryScore = 0;
//     let matchedKeyword = "";
//     for (const keyword of config.keywords) {
//       if (t.includes(keyword)) {
//         const keywordScore = keyword.length / 10;
//         if (keywordScore > categoryScore) {
//           categoryScore = keywordScore;
//           matchedKeyword = keyword;
//         }
//       }
//     }
//     if (categoryScore > 0) {
//       const priorityWeight = 1 / config.priority;
//       const finalScore = categoryScore * priorityWeight;
//       if (finalScore > maxScore) {
//         maxScore = finalScore;
//         bestMatch = {
//           subcategory: matchedKeyword,
//           mainCategory: main,
//           confidence: Math.min(0.9, 0.7 + (finalScore * 0.2)),
//           raw: text
//         };
//       }
//     }
//   }
//   return bestMatch || { subcategory: "other", mainCategory: "Other", confidence: 0.35, raw: text };
// }

// /* ---------------- JSON parsing ---------------- */
// function extractJsonFromText(aiText) {
//   if (!aiText) return null;
//   let s = String(aiText).trim();
//   s = s.replace(/^\s*```[\s\S]*?\n/, "").replace(/```$/, "").trim();
//   const firstBraceIdx = s.indexOf("{");
//   const lastBraceIdx = s.lastIndexOf("}");
//   if (firstBraceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > firstBraceIdx) {
//     const jsonText = s.slice(firstBraceIdx, lastBraceIdx + 1);
//     try {
//       return JSON.parse(jsonText);
//     } catch (e) {
//       console.warn("JSON parse failed:", e.message);
//     }
//   }
//   try {
//     return JSON.parse(s);
//   } catch (e) {
//     return null;
//   }
// }

// function parseCategoryResponse(aiText) {
//   const raw = (aiText || "").toString().trim();
//   const parsed = extractJsonFromText(raw);
//   if (parsed && (parsed.mainCategory || parsed.category || parsed.subcategory)) {
//     const sub = parsed.subcategory || parsed.category || "";
//     let main = parsed.mainCategory || parsed.main || mapSubToMain(sub);
//     if (!ALLOWED_MAIN_CATEGORIES.includes(main)) {
//       main = mapSubToMain(sub);
//     }
//     const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
//     const isPhoto = typeof parsed.isPhoto === "boolean" ? parsed.isPhoto : true;
//     const explanation = parsed.explanation || "";
//     return { subcategory: sub, mainCategory: main, confidence, isPhoto, explanation, raw };
//   }
//   const pat = /Category[:\s]*([A-Za-z0-9 _-]+)[,;\s]*Confidence[:\s]*([0-9.]+)/i;
//   const m = raw.match(pat);
//   if (m) {
//     const sub = m[1].trim();
//     const conf = parseFloat(m[2]);
//     return { subcategory: sub, mainCategory: mapSubToMain(sub), confidence: isNaN(conf) ? 0.5 : Math.max(0, Math.min(1, conf)), raw };
//   }
//   return classifyByKeywords(raw);
// }

// /* ---------------- Prompts ---------------- */
// function buildImagePrompt() {
//   const categories = ALLOWED_MAIN_CATEGORIES.join(", ");
//   return `You are an expert civic infrastructure problem classifier analyzing citizen-reported issues.
// TASK: Analyze this image to identify the PRIMARY civic infrastructure problem that a citizen is reporting.
// AVAILABLE CATEGORIES: ${categories}
// ...
// OUTPUT FORMAT (JSON only):
// {
//   "subcategory": "specific_issue_name",
//   "mainCategory": "one_of_the_main_categories",
//   "confidence": 0.0-1.0,
//   "isPhoto": true,
//   "explanation": "brief description of what you see"
// }`;
// }

// function buildTextPrompt() {
//   const categories = ALLOWED_MAIN_CATEGORIES.join(", ");
//   return `You are a civic issues text classifier for citizen complaints.
// AVAILABLE CATEGORIES: ${categories}
// Analyze the text description and classify the civic infrastructure issue being reported.
// OUTPUT FORMAT (JSON only):
// {
//   "subcategory": "specific_issue_name",
//   "mainCategory": "one_of_the_main_categories",
//   "confidence": 0.0-1.0,
//   "explanation": "brief explanation"
// }`;
// }

// /* ---------------- NEW: Safety prompt ---------------- */
// function buildSafetyPrompt() {
//   return `You are a content safety classifier for a civic reporting platform.
// TASK: Determine if this image is appropriate for a public civic issue reporting platform.

// APPROPRIATE CONTENT:
// - Infrastructure problems (roads, lights, utilities)
// - Public spaces and facilities
// - Civic issues and complaints
// - Environmental problems
// - Public safety concerns

// INAPPROPRIATE CONTENT:
// - Nudity or explicit sexual content
// - Private spaces (bedrooms, private bathrooms)
// - Personal/private photos unrelated to civic issues
// - Violence or harassment
// - Content clearly not related to civic infrastructure

// OUTPUT FORMAT (JSON only):
// {
//   "isAppropriate": true/false,
//   "confidence": 0.0-1.0,
//   "reason": "brief explanation if inappropriate, empty if appropriate"
// }`;
// }

// /* ---------------- Gemini analysis ---------------- */
// async function analyzeImageWithGemini(imageUrlOrPath) {
//   if (!geminiModel) throw new Error("Gemini model not initialized");
//   const base64 = await fetchImageBase64(imageUrlOrPath);
//   if (!base64) return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
//   try {
//     const prompt = buildImagePrompt();
//     const response = await geminiModel.generateContent([
//       { inlineData: { mimeType: "image/jpeg", data: base64 } },
//       { text: prompt }
//     ]);
//     const aiText = response?.response?.text?.() || "";
//     const result = parseCategoryResponse(aiText);
//     if (result.isPhoto === false) {
//       result.confidence *= 0.3;
//       console.warn("Image classified as non-photo, reducing confidence");
//     }
//     if (result.mainCategory !== "Other" && result.confidence > IMAGE_MIN_CONFIDENCE) {
//       result.confidence = Math.min(1.0, result.confidence + 0.1);
//     }
//     return result;
//   } catch (error) {
//     console.warn("Gemini image analysis failed:", error.message);
//     throw error;
//   }
// }

// async function analyzeTextWithGemini(text) {
//   if (!geminiModel) throw new Error("Gemini model not initialized");
//   const prompt = buildTextPrompt() + "\n\nUser Description: \"" + (text || "").replace(/"/g, '\\"') + "\"";
//   try {
//     const response = await geminiModel.generateContent([{ text: prompt }]);
//     const aiText = response?.response?.text?.() || "";
//     return parseCategoryResponse(aiText);
//   } catch (error) {
//     console.warn("Gemini text analysis failed:", error.message);
//     throw error;
//   }
// }

// /* ---------------- NEW: Safety analysis ---------------- */
// async function checkImageSafety(imageUrlOrPath) {
//   if (!geminiModel) return { isAppropriate: true, confidence: 1.0, reason: "" };
//   const base64 = await fetchImageBase64(imageUrlOrPath);
//   if (!base64) return { isAppropriate: true, confidence: 1.0, reason: "" };
//   try {
//     const prompt = buildSafetyPrompt();
//     const response = await geminiModel.generateContent([
//       { inlineData: { mimeType: "image/jpeg", data: base64 } },
//       { text: prompt }
//     ]);
//     const aiText = response?.response?.text?.() || "";
//     const parsed = extractJsonFromText(aiText);
//     if (parsed && typeof parsed.isAppropriate === "boolean") {
//       return { isAppropriate: parsed.isAppropriate, confidence: parsed.confidence || 0.8, reason: parsed.reason || "" };
//     }
//     return { isAppropriate: true, confidence: 0.5, reason: "" };
//   } catch (error) {
//     console.warn("Safety check failed:", error.message);
//     return { isAppropriate: true, confidence: 0.0, reason: "Safety check failed" };
//   }
// }

// /* ---------------- UPDATED analyzeFromImage ---------------- */
// async function analyzeFromImage(imageUrlOrPath) {
//   try {
//     if (USE_GEMINI && geminiModel) {
//       const safetyCheck = await checkImageSafety(imageUrlOrPath);
//       if (!safetyCheck.isAppropriate && safetyCheck.confidence >= 0.8) {
//         console.warn("Image failed safety check:", safetyCheck.reason);
//         return { subcategory: "", mainCategory: "", confidence: 0, isAppropriate: false, inappropriateReason: safetyCheck.reason, needsReview: true, raw: "" };
//       }
//       const categoryResult = await analyzeImageWithGemini(imageUrlOrPath);
//       return { ...categoryResult, isAppropriate: safetyCheck.isAppropriate, inappropriateReason: safetyCheck.reason, needsReview: !safetyCheck.isAppropriate, safetyConfidence: safetyCheck.confidence };
//     }
//   } catch (err) {
//     console.warn("analyzeFromImage fallback:", err?.message || err);
//   }
//   return { subcategory: "other", mainCategory: "Other", confidence: 0.2, raw: "", isAppropriate: true, inappropriateReason: "", needsReview: false };
// }

// /* ---------------- analyzeFromText ---------------- */
// async function analyzeFromText(text) {
//   try {
//     if (USE_GEMINI && geminiModel) {
//       return await analyzeTextWithGemini(text);
//     }
//   } catch (err) {
//     console.warn("analyzeFromText fallback:", err?.message || err);
//   }
//   return classifyByKeywords(text);
// }

// /* ---------------- analyzeAll (unchanged) ---------------- */
// async function analyzeAll({ image, text, voiceTranscript }) {
//   console.log("Starting analysis with:", { hasImage: !!image, hasText: !!text, hasVoice: !!voiceTranscript });
  
//   // Run analyses in parallel
//   const [imageRes, textRes, voiceRes] = await Promise.all([
//     image ? analyzeFromImage(image).catch(err => {
//       console.warn("Image analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
//     }) : null,
//     text ? analyzeFromText(text).catch(err => {
//       console.warn("Text analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
//     }) : null,
//     voiceTranscript ? analyzeFromText(voiceTranscript).catch(err => {
//       console.warn("Voice analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
//     }) : null
//   ]);

//   // Create weighted candidates
//   const candidates = [];
//   if (imageRes) {
//     let weight = IMAGE_WEIGHT;
    
//     // Reduce weight for non-photos or low confidence
//     if (imageRes.isPhoto === false) weight *= 0.2;
//     if (imageRes.confidence < IMAGE_MIN_CONFIDENCE) weight *= 0.5;
    
//     candidates.push({ 
//       ...imageRes, 
//       source: "image", 
//       weight, 
//       main: imageRes.mainCategory || mapSubToMain(imageRes.subcategory),
//       score: imageRes.confidence * weight
//     });
//   }
  
//   if (textRes) {
//     candidates.push({ 
//       ...textRes, 
//       source: "text", 
//       weight: TEXT_WEIGHT, 
//       main: textRes.mainCategory || mapSubToMain(textRes.subcategory),
//       score: textRes.confidence * TEXT_WEIGHT
//     });
//   }
  
//   if (voiceRes) {
//     candidates.push({ 
//       ...voiceRes, 
//       source: "voice", 
//       weight: VOICE_WEIGHT, 
//       main: voiceRes.mainCategory || mapSubToMain(voiceRes.subcategory),
//       score: voiceRes.confidence * VOICE_WEIGHT
//     });
//   }

//   // Enhanced best candidate selection
//   let best = { main: "Other", confidence: 0, source: "none" };
//   if (candidates.length > 0) {
//     // Sort by score (confidence * weight)
//     candidates.sort((a, b) => b.score - a.score);
//     best = candidates[0];
    
//     console.log("Candidates ranked by score:", candidates.map(c => ({
//       source: c.source,
//       category: c.main,
//       confidence: c.confidence,
//       weight: c.weight,
//       score: c.score
//     })));
//   }

//   // Enhanced consensus detection
//   const categoryVotes = {};
//   for (const c of candidates) {
//     const cat = (c.main || "Other").toLowerCase();
//     if (!categoryVotes[cat]) {
//       categoryVotes[cat] = { count: 0, totalConfidence: 0, sources: [] };
//     }
//     categoryVotes[cat].count++;
//     categoryVotes[cat].totalConfidence += c.confidence;
//     categoryVotes[cat].sources.push(c.source);
//   }

//   let consensus = null;
//   let maxVotes = 0;
//   for (const [cat, votes] of Object.entries(categoryVotes)) {
//     if (votes.count >= 2 && votes.count > maxVotes) {
//       maxVotes = votes.count;
//       const avgConfidence = votes.totalConfidence / votes.count;
//       const candidate = candidates.find(x => (x.main || "").toLowerCase() === cat);
//       consensus = {
//         mainCategory: candidate?.main || "Other",
//         confidence: Math.min(1.0, avgConfidence + CONSENSUS_BOOST),
//         sources: votes.sources,
//         votes: votes.count
//       };
//     }
//   }

//   // Final validation: if image has high confidence, prefer it over consensus
//   if (imageRes && imageRes.confidence >= IMAGE_MIN_CONFIDENCE && imageRes.mainCategory !== "Other") {
//     console.log("High-confidence image result found, prioritizing image analysis");
//     best = candidates.find(c => c.source === "image") || best;
//   }

//   // Final fallback: use keyword classification on text if available
//   if ((!best.main || best.main === "Other") && text) {
//     const keywordResult = classifyByKeywords(text);
//     if (keywordResult.mainCategory !== "Other") {
//       console.log("Using keyword fallback classification");
//       best = { 
//         ...keywordResult, 
//         source: "keyword-fallback",
//         confidence: Math.max(best.confidence, keywordResult.confidence * 0.8)
//       };
//     }
//   }

//   const result = {
//     image: imageRes,
//     text: textRes,
//     voice: voiceRes,
//     best: { 
//       mainCategory: best.main || best.mainCategory || "Other", 
//       confidence: Math.max(0, Math.min(1, best.confidence || 0)), 
//       source: best.source || "none",
//       explanation: best.explanation || "",
//       raw: best 
//     },
//     consensus,
//     debug: {
//       candidates: candidates.map(c => ({
//         source: c.source,
//         category: c.main,
//         confidence: c.confidence,
//         score: c.score
//       }))
//     }
//   };

//   console.log("Final analysis result:", {
//     best: result.best.mainCategory,
//     confidence: result.best.confidence,
//     source: result.best.source,
//     hasConsensus: !!consensus
//   });

//   return result;
// }
// /* ---------------- Exports ---------------- */
// module.exports = { analyzeFromText, analyzeFromImage, analyzeAll, CATEGORY_MAP, ALLOWED_MAIN_CATEGORIES };






































//currentworking oneee
// require('dotenv').config()

// const axios = require('axios')
// const fs = require('fs')
// const path = require('path')
// const sharp = require('sharp')

// let geminiModel = null
// const USE_GEMINI = process.env.USE_GEMINI !== "false" && !!process.env.GEMINI_API_KEY;
// if (USE_GEMINI) {
//     try {
//         const { GoogleGenerativeAI } = require("@google/generative-ai");
//         const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//         geminiModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
//     } catch (e) {
//         console.warn("Gemini init failed — falling back to keyword classifier.", e.message || e);
//         geminiModel = null;
//     }
// }


// // Enhanced category mapping with more specific keywords
// const CATEGORY_MAP = {
//   "Garbage": {
//     keywords: ["garbage", "trash", "litter", "dump", "rubbish", "waste", "dumping", "open dump", "garbage pile", "refuse", "debris", "scattered waste", "littering", "garbage collection"],
//     priority: 1
//   },
//   "Road Issues": {
//     keywords: ["pothole", "sinkhole", "broken road", "road damage", "cracked road", "road collapse", "road erosion", "broken footpath", "missing slab", "uneven surface", "road blockage", "road subsidence", "manhole cover missing", "damaged curb", "pavement damage", "street repair"],
//     priority: 2
//   },
//   "Street Light Issue": {
//     keywords: ["streetlight", "lamp", "light not working", "lamp post", "street light", "light pole", "bulb out", "flickering light", "electric pole light", "broken light", "dark street", "lighting problem"],
//     priority: 3
//   },
//   "Water Leakage": {
//     keywords: ["leak", "water leak", "burst pipe", "pipe leak", "sewage leak", "water overflow", "manhole overflow", "drainage leak", "flooding", "water logging", "broken pipe", "water wastage"],
//     priority: 2
//   },
//   "Illegal Construction": {
//     keywords: ["illegal construction", "unauthorized construction", "encroachment", "unauthorized building", "makeshift structure", "illegal building", "blocking road", "unauthorized structure"],
//     priority: 3
//   },
//   "Sanitation": {
//     keywords: ["toilet", "sewage", "sewage overflow", "open drain", "open defecation", "toilet block", "sanitation", "septic", "sewage smell", "drainage", "clogged drain", "dirty water"],
//     priority: 2
//   },
//   "Traffic Signage": {
//     keywords: ["signage", "traffic sign", "road sign missing", "traffic signal", "stop sign missing", "sign damaged", "road sign", "traffic light broken", "signal not working"],
//     priority: 3
//   },
//   "Other": {
//     keywords: ["other", "miscellaneous", "general issue"],
//     priority: 4
//   }
// };

// const ALLOWED_MAIN_CATEGORIES = Object.keys(CATEGORY_MAP);

// // Configuration
// const MAX_IMAGE_WIDTH = parseInt(process.env.AI_MAX_IMAGE_WIDTH || "1024", 10);
// const JPEG_QUALITY = parseInt(process.env.AI_JPEG_QUALITY || "78", 10);
// const AXIOS_TIMEOUT = parseInt(process.env.AI_AXIOS_TIMEOUT_MS || "120000", 10);

// // Enhanced weights - prioritizing image analysis
// const IMAGE_WEIGHT = parseFloat(process.env.AI_IMAGE_WEIGHT || "4.0");
// const TEXT_WEIGHT = parseFloat(process.env.AI_TEXT_WEIGHT || "1.5");
// const VOICE_WEIGHT = parseFloat(process.env.AI_VOICE_WEIGHT || "1.2");
// const CONSENSUS_BOOST = parseFloat(process.env.AI_CONSENSUS_BOOST || "0.15");
// const IMAGE_MIN_CONFIDENCE = parseFloat(process.env.AI_IMAGE_MIN_CONFIDENCE || "0.6");

// /* --------------- Image processing utilities --------------- */
// async function downloadImageBuffer(urlOrPath) {
//   if (!urlOrPath) return null;
//   try {
//     if (/^https?:\/\//i.test(urlOrPath)) {
//       const resp = await axios.get(urlOrPath, {
//         responseType: "arraybuffer",
//         timeout: AXIOS_TIMEOUT,
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity
//       });
//       return Buffer.from(resp.data);
//     } else {
//       const abs = path.resolve(urlOrPath);
//       if (!fs.existsSync(abs)) return null;
//       return fs.readFileSync(abs);
//     }
//   } catch (err) {
//     console.warn("downloadImageBuffer error:", err?.message || err);
//     return null;
//   }
// }

// async function processImageBuffer(buffer) {
//   if (!buffer) return null;
//   try {
//     const processed = await sharp(buffer, { failOnError: false })
//       .rotate()
//       .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
//       .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
//       .toBuffer();
//     return processed;
//   } catch (err) {
//     console.warn("processImageBuffer error:", err?.message || err);
//     return null;
//   }
// }

// async function fetchImageBase64(imageUrlOrPath) {
//   try {
//     const raw = await downloadImageBuffer(imageUrlOrPath);
//     if (!raw) return null;
//     const processed = await processImageBuffer(raw);
//     const final = processed || raw;
//     return final.toString("base64");
//   } catch (err) {
//     console.warn("fetchImageBase64 error:", err?.message || err);
//     return null;
//   }
// }

// /* --------------- Enhanced keyword classifier --------------- */
// function mapSubToMain(subcategory) {
//   if (!subcategory) return "Other";
//   const t = subcategory.toLowerCase();
  
//   for (const [main, config] of Object.entries(CATEGORY_MAP)) {
//     for (const keyword of config.keywords) {
//       if (t.includes(keyword)) return main;
//     }
//   }
//   return "Other";
// }

// function classifyByKeywords(text = "") {
//   const t = (text || "").toLowerCase().trim();
//   if (!t) return { subcategory: "other", mainCategory: "Other", confidence: 0.15, raw: text };

//   let bestMatch = null;
//   let maxScore = 0;
  
//   // Enhanced keyword matching with scoring
//   for (const [main, config] of Object.entries(CATEGORY_MAP)) {
//     let categoryScore = 0;
//     let matchedKeyword = "";
    
//     for (const keyword of config.keywords) {
//       if (t.includes(keyword)) {
//         // Longer keywords get higher scores
//         const keywordScore = keyword.length / 10;
//         if (keywordScore > categoryScore) {
//           categoryScore = keywordScore;
//           matchedKeyword = keyword;
//         }
//       }
//     }
    
//     // Apply priority weighting (lower priority number = higher weight)
//     if (categoryScore > 0) {
//       const priorityWeight = 1 / config.priority;
//       const finalScore = categoryScore * priorityWeight;
      
//       if (finalScore > maxScore) {
//         maxScore = finalScore;
//         bestMatch = {
//           subcategory: matchedKeyword,
//           mainCategory: main,
//           confidence: Math.min(0.9, 0.7 + (finalScore * 0.2)),
//           raw: text
//         };
//       }
//     }
//   }
  
//   return bestMatch || { subcategory: "other", mainCategory: "Other", confidence: 0.35, raw: text };
// }

// /* --------------- Enhanced response parsing --------------- */
// function extractJsonFromText(aiText) {
//   if (!aiText) return null;
//   let s = String(aiText).trim();

//   // Remove code blocks
//   s = s.replace(/^\s*```[\s\S]*?\n/, "").replace(/```$/, "").trim();

//   // Find JSON block
//   const firstBraceIdx = s.indexOf("{");
//   const lastBraceIdx = s.lastIndexOf("}");
//   if (firstBraceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > firstBraceIdx) {
//     const jsonText = s.slice(firstBraceIdx, lastBraceIdx + 1);
//     try {
//       return JSON.parse(jsonText);
//     } catch (e) {
//       console.warn("JSON parse failed:", e.message);
//     }
//   }

//   try {
//     return JSON.parse(s);
//   } catch (e) {
//     return null;
//   }
// }

// function parseCategoryResponse(aiText) {
//   const raw = (aiText || "").toString().trim();

//   const parsed = extractJsonFromText(raw);
//   if (parsed && (parsed.mainCategory || parsed.category || parsed.subcategory)) {
//     const sub = parsed.subcategory || parsed.category || "";
//     let main = parsed.mainCategory || parsed.main || mapSubToMain(sub);
    
//     // Validate main category
//     if (!ALLOWED_MAIN_CATEGORIES.includes(main)) {
//       main = mapSubToMain(sub);
//     }
    
//     const confidence = typeof parsed.confidence === "number" ? 
//       Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
//     const isPhoto = typeof parsed.isPhoto === "boolean" ? parsed.isPhoto : true;
//     const explanation = parsed.explanation || "";
    
//     return { 
//       subcategory: sub, 
//       mainCategory: main, 
//       confidence, 
//       isPhoto, 
//       explanation,
//       raw 
//     };
//   }

//   // Fallback regex parsing
//   const pat = /Category[:\s]*([A-Za-z0-9 _-]+)[,;\s]*Confidence[:\s]*([0-9.]+)/i;
//   const m = raw.match(pat);
//   if (m) {
//     const sub = m[1].trim();
//     const conf = parseFloat(m[2]);
//     return { 
//       subcategory: sub, 
//       mainCategory: mapSubToMain(sub), 
//       confidence: isNaN(conf) ? 0.5 : Math.max(0, Math.min(1, conf)), 
//       raw 
//     };
//   }

//   // Final fallback to keyword matching
//   return classifyByKeywords(raw);
// }

// /* --------------- Enhanced Gemini prompts --------------- */
// function buildImagePrompt() {
//   const categories = ALLOWED_MAIN_CATEGORIES.join(", ");
//   return `You are an expert civic infrastructure problem classifier analyzing citizen-reported issues.

// TASK: Analyze this image to identify the PRIMARY civic infrastructure problem that a citizen is reporting.

// AVAILABLE CATEGORIES: ${categories}

// ANALYSIS RULES:
// 1. This is a REAL PHOTOGRAPH taken by a citizen reporting an infrastructure problem
// 2. Focus ONLY on visible civic infrastructure issues (roads, utilities, cleanliness, construction, etc.)
// 3. Identify the MAIN problem that dominates the image - what would a citizen be complaining about?
// 4. Ignore people, vehicles, background elements - focus on the infrastructure issue
// 5. If you see multiple issues, pick the most prominent/severe one

// SPECIFIC INDICATORS:
// - Garbage: Scattered trash, garbage piles, littered areas, waste accumulation
// - Road Issues: Potholes, cracks, broken pavement, damaged roads, missing manholes
// - Street Light Issue: Broken/missing lights, damaged poles, non-functional lighting
// - Water Leakage: Visible water leaks, burst pipes, flooding, water overflow
// - Illegal Construction: Unauthorized structures, encroachments, blocking public areas
// - Sanitation: Open drains, sewage issues, toilet problems, unhygienic conditions
// - Traffic Signage: Missing/damaged signs, broken signals, defective traffic equipment

// OUTPUT FORMAT (JSON only):
// {
//   "subcategory": "specific_issue_name",
//   "mainCategory": "one_of_the_main_categories",
//   "confidence": 0.0-1.0,
//   "isPhoto": true,
//   "explanation": "brief description of what you see"
// }

// Be decisive and confident in your analysis. Focus on what infrastructure problem this citizen is trying to report.`;
// }

// function buildTextPrompt() {
//   const categories = ALLOWED_MAIN_CATEGORIES.join(", ");
//   return `You are a civic issues text classifier for citizen complaints.

// AVAILABLE CATEGORIES: ${categories}

// Analyze the text description and classify the civic infrastructure issue being reported.

// OUTPUT FORMAT (JSON only):
// {
//   "subcategory": "specific_issue_name",
//   "mainCategory": "one_of_the_main_categories", 
//   "confidence": 0.0-1.0,
//   "explanation": "brief explanation"
// }

// Focus on the main infrastructure problem being described.`;
// }

// /* --------------- Enhanced Gemini analysis functions --------------- */
// async function analyzeImageWithGemini(imageUrlOrPath) {
//   if (!geminiModel) throw new Error("Gemini model not initialized");
  
//   const base64 = await fetchImageBase64(imageUrlOrPath);
//   if (!base64) return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };

//   try {
//     const prompt = buildImagePrompt();
    
//     const response = await geminiModel.generateContent([
//       { inlineData: { mimeType: "image/jpeg", data: base64 } },
//       { text: prompt }
//     ]);

//     const aiText = response?.response?.text?.() || "";
//     const result = parseCategoryResponse(aiText);
    
//     // Enhanced validation for image analysis
//     if (result.isPhoto === false) {
//       result.confidence *= 0.3; // Heavily penalize non-photos
//       console.warn("Image classified as non-photo, reducing confidence");
//     }
    
//     // Boost confidence if we got a good match
//     if (result.mainCategory !== "Other" && result.confidence > IMAGE_MIN_CONFIDENCE) {
//       result.confidence = Math.min(1.0, result.confidence + 0.1);
//     }
    
//     return result;
//   } catch (error) {
//     console.warn("Gemini image analysis failed:", error.message);
//     throw error;
//   }
// }

// async function analyzeTextWithGemini(text) {
//   if (!geminiModel) throw new Error("Gemini model not initialized");
  
//   const prompt = buildTextPrompt() + "\n\nUser Description: \"" + (text || "").replace(/"/g, '\\"') + "\"";
  
//   try {
//     const response = await geminiModel.generateContent([
//       { text: prompt }
//     ]);

//     const aiText = response?.response?.text?.() || "";
//     return parseCategoryResponse(aiText);
//   } catch (error) {
//     console.warn("Gemini text analysis failed:", error.message);
//     throw error;
//   }
// }

// /* --------------- Main analysis functions --------------- */
// async function analyzeFromText(text) {
//   try {
//     if (USE_GEMINI && geminiModel) {
//       return await analyzeTextWithGemini(text);
//     }
//   } catch (err) {
//     console.warn("analyzeFromText fallback:", err?.message || err);
//   }
//   return classifyByKeywords(text);
// }

// async function analyzeFromImage(imageUrlOrPath) {
//   try {
//     if (USE_GEMINI && geminiModel) {
//       const result = await analyzeImageWithGemini(imageUrlOrPath);
      
//       // If image analysis has low confidence, try to boost with additional validation
//       if (result.confidence < IMAGE_MIN_CONFIDENCE && result.mainCategory === "Other") {
//         console.warn("Low confidence image analysis, result may be unreliable");
//       }
      
//       return result;
//     }
//   } catch (err) {
//     console.warn("analyzeFromImage fallback:", err?.message || err);
//   }
//   return { subcategory: "other", mainCategory: "Other", confidence: 0.2, raw: "" };
// }

// /**
//  * Enhanced analyzeAll with image-first priority and better consensus logic
//  */
// async function analyzeAll({ image, text, voiceTranscript }) {
//   console.log("Starting analysis with:", { hasImage: !!image, hasText: !!text, hasVoice: !!voiceTranscript });
  
//   // Run analyses in parallel
//   const [imageRes, textRes, voiceRes] = await Promise.all([
//     image ? analyzeFromImage(image).catch(err => {
//       console.warn("Image analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
//     }) : null,
//     text ? analyzeFromText(text).catch(err => {
//       console.warn("Text analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
//     }) : null,
//     voiceTranscript ? analyzeFromText(voiceTranscript).catch(err => {
//       console.warn("Voice analysis failed:", err.message);
//       return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };
//     }) : null
//   ]);

//   // Create weighted candidates
//   const candidates = [];
//   if (imageRes) {
//     let weight = IMAGE_WEIGHT;
    
//     // Reduce weight for non-photos or low confidence
//     if (imageRes.isPhoto === false) weight *= 0.2;
//     if (imageRes.confidence < IMAGE_MIN_CONFIDENCE) weight *= 0.5;
    
//     candidates.push({ 
//       ...imageRes, 
//       source: "image", 
//       weight, 
//       main: imageRes.mainCategory || mapSubToMain(imageRes.subcategory),
//       score: imageRes.confidence * weight
//     });
//   }
  
//   if (textRes) {
//     candidates.push({ 
//       ...textRes, 
//       source: "text", 
//       weight: TEXT_WEIGHT, 
//       main: textRes.mainCategory || mapSubToMain(textRes.subcategory),
//       score: textRes.confidence * TEXT_WEIGHT
//     });
//   }
  
//   if (voiceRes) {
//     candidates.push({ 
//       ...voiceRes, 
//       source: "voice", 
//       weight: VOICE_WEIGHT, 
//       main: voiceRes.mainCategory || mapSubToMain(voiceRes.subcategory),
//       score: voiceRes.confidence * VOICE_WEIGHT
//     });
//   }

//   // Enhanced best candidate selection
//   let best = { main: "Other", confidence: 0, source: "none" };
//   if (candidates.length > 0) {
//     // Sort by score (confidence * weight)
//     candidates.sort((a, b) => b.score - a.score);
//     best = candidates[0];
    
//     console.log("Candidates ranked by score:", candidates.map(c => ({
//       source: c.source,
//       category: c.main,
//       confidence: c.confidence,
//       weight: c.weight,
//       score: c.score
//     })));
//   }

//   // Enhanced consensus detection
//   const categoryVotes = {};
//   for (const c of candidates) {
//     const cat = (c.main || "Other").toLowerCase();
//     if (!categoryVotes[cat]) {
//       categoryVotes[cat] = { count: 0, totalConfidence: 0, sources: [] };
//     }
//     categoryVotes[cat].count++;
//     categoryVotes[cat].totalConfidence += c.confidence;
//     categoryVotes[cat].sources.push(c.source);
//   }

//   let consensus = null;
//   let maxVotes = 0;
//   for (const [cat, votes] of Object.entries(categoryVotes)) {
//     if (votes.count >= 2 && votes.count > maxVotes) {
//       maxVotes = votes.count;
//       const avgConfidence = votes.totalConfidence / votes.count;
//       const candidate = candidates.find(x => (x.main || "").toLowerCase() === cat);
//       consensus = {
//         mainCategory: candidate?.main || "Other",
//         confidence: Math.min(1.0, avgConfidence + CONSENSUS_BOOST),
//         sources: votes.sources,
//         votes: votes.count
//       };
//     }
//   }

//   // Final validation: if image has high confidence, prefer it over consensus
//   if (imageRes && imageRes.confidence >= IMAGE_MIN_CONFIDENCE && imageRes.mainCategory !== "Other") {
//     console.log("High-confidence image result found, prioritizing image analysis");
//     best = candidates.find(c => c.source === "image") || best;
//   }

//   // Final fallback: use keyword classification on text if available
//   if ((!best.main || best.main === "Other") && text) {
//     const keywordResult = classifyByKeywords(text);
//     if (keywordResult.mainCategory !== "Other") {
//       console.log("Using keyword fallback classification");
//       best = { 
//         ...keywordResult, 
//         source: "keyword-fallback",
//         confidence: Math.max(best.confidence, keywordResult.confidence * 0.8)
//       };
//     }
//   }

//   const result = {
//     image: imageRes,
//     text: textRes,
//     voice: voiceRes,
//     best: { 
//       mainCategory: best.main || best.mainCategory || "Other", 
//       confidence: Math.max(0, Math.min(1, best.confidence || 0)), 
//       source: best.source || "none",
//       explanation: best.explanation || "",
//       raw: best 
//     },
//     consensus,
//     debug: {
//       candidates: candidates.map(c => ({
//         source: c.source,
//         category: c.main,
//         confidence: c.confidence,
//         score: c.score
//       }))
//     }
//   };

//   console.log("Final analysis result:", {
//     best: result.best.mainCategory,
//     confidence: result.best.confidence,
//     source: result.best.source,
//     hasConsensus: !!consensus
//   });

//   return result;
// }

// module.exports = {
//   analyzeFromText,
//   analyzeFromImage,
//   analyzeAll,
//   CATEGORY_MAP,
//   ALLOWED_MAIN_CATEGORIES
// };




















// require('dotenv').config()

// const axios=require('axios')
// const { raw } = require('express')
// const fs=require('fs')
// const path=require('path')
// const sharp=require('sharp')
// const { buffer, text } = require('stream/consumers')

// let geminiModel=null
// const USE_GEMINI = process.env.USE_GEMINI !== "false" && !!process.env.GEMINI_API_KEY;
// if (USE_GEMINI) {
//     try {
//         const { GoogleGenerativeAI } = require("@google/generative-ai");
//         const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//         geminiModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
//     } catch (e) {
//         console.warn("Gemini init failed — falling back to keyword classifier.", e.message || e);
//         geminiModel = null;
//     }
// }

// const CATEGORY_MAP = {
//   "Garbage": ["garbage","trash","litter","dump","rubbish","waste","dumping","open dump","garbage pile","refuse"],
//   "Road Issues": ["pothole","sinkhole","broken road","road damage","cracked road","road collapse","road erosion","broken footpath","missing slab","uneven surface","road blockage","road subsidence","manhole cover missing","damaged curb"],
//   "Street Light Issue": ["streetlight","lamp","light not working","lamp post","street light","light pole","bulb out","flickering light","electric pole light"],
//   "Water Leakage": ["leak","water leak","burst pipe","pipe leak","sewage leak","water overflow","manhole overflow","drainage leak"],
//   "Illegal Construction": ["illegal construction","unauthorized construction","encroachment","unauthorized building","makeshift structure","illegal building"],
//   "Sanitation": ["toilet","sewage","sewage overflow","open drain","open defecation","toilet block","sanitation","septic","sewage smell"],
//   "Traffic Signage": ["signage","traffic sign","road sign missing","traffic signal","stop sign missing","sign damaged","road sign"],
//   "Other": ["other"]
// };

// const ALLOWED_MAIN_CATEGORIES = Object.keys(CATEGORY_MAP);

// // Tunables
// const MAX_IMAGE_WIDTH = parseInt(process.env.AI_MAX_IMAGE_WIDTH || "1024", 10);
// const JPEG_QUALITY = parseInt(process.env.AI_JPEG_QUALITY || "78", 10);
// const AXIOS_TIMEOUT = parseInt(process.env.AI_AXIOS_TIMEOUT_MS || "120000", 10);

// // thresholds and weights
// const IMAGE_CONF_THRESHOLD = parseFloat(process.env.AI_IMAGE_CONF_THRESHOLD || "0.5");
// const IMAGE_WEIGHT = parseFloat(process.env.AI_IMAGE_WEIGHT || "3.0");
// const TEXT_WEIGHT = parseFloat(process.env.AI_TEXT_WEIGHT || "1.0");
// const VOICE_WEIGHT = parseFloat(process.env.AI_VOICE_WEIGHT || "1.0");
// const CONSENSUS_BOOST = parseFloat(process.env.AI_CONSENSUS_BOOST || "0.12");

// /* --------------- Utilities: image download & preprocess --------------- */
// async function downloadImageBuffer(urlOrPath) {
//   if (!urlOrPath) return null;
//   try {
//     if (/^https?:\/\//i.test(urlOrPath)) {
//       const resp = await axios.get(urlOrPath, {
//         responseType: "arraybuffer",
//         timeout: AXIOS_TIMEOUT,
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity
//       });
//       return Buffer.from(resp.data);
//     } else {
//       const abs = path.resolve(urlOrPath);
//       if (!fs.existsSync(abs)) return null;
//       return fs.readFileSync(abs);
//     }
//   } catch (err) {
//     console.warn("downloadImageBuffer error:", err?.message || err);
//     return null;
//   }
// }

// async function processImageBuffer(buffer) {
//   if (!buffer) return null;
//   try {
//     const processed = await sharp(buffer, { failOnError: false })
//       .rotate()
//       .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
//       .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
//       .toBuffer();
//     return processed;
//   } catch (err) {
//     console.warn("processImageBuffer error:", err?.message || err);
//     return null;
//   }
// }

// async function fetchImageBase64(imageUrlOrPath) {
//   try {
//     const raw = await downloadImageBuffer(imageUrlOrPath);
//     if (!raw) return null;
//     const processed = await processImageBuffer(raw);
//     const final = processed || raw;
//     return final.toString("base64");
//   } catch (err) {
//     console.warn("fetchImageBase64 error:", err?.message || err);
//     return null;
//   }
// }

// /* --------------- Keyword fallback classifier (robust + maps sub -> main) --------------- */
// function mapSubToMain(subcategory) {
//   if (!subcategory) return "Other";
//   const t = subcategory.toLowerCase();
//   for (const [main, subs] of Object.entries(CATEGORY_MAP)) {
//     for (const s of subs) {
//       if (t.includes(s)) return main;
//     }
//   }
//   return "Other";
// }

// function classifyByKeywords(text = "") {
//   const t = (text || "").toLowerCase().trim();
//   if (!t) return { subcategory: "other", mainCategory: "Other", confidence: 0.15, raw: text };

//   // Search for any subkeyword
//   for (const [main, subs] of Object.entries(CATEGORY_MAP)) {
//     for (const sub of subs) {
//       if (t.includes(sub)) {
//         // slightly higher confidence if multiple hits
//         return { subcategory: sub, mainCategory: main, confidence: 0.9, raw: text };
//       }
//     }
//   }

//   // fallback fuzzy: check single keywords words like 'pothole'
//   const words = t.split(/\W+/);
//   for (const w of words) {
//     for (const [main, subs] of Object.entries(CATEGORY_MAP)) {
//       if (subs.includes(w)) return { subcategory: w, mainCategory: main, confidence: 0.75, raw: text };
//     }
//   }

//   return { subcategory: "other", mainCategory: "Other", confidence: 0.35, raw: text };
// }

// /* --------------- Robust parse of model output --------------- */
// function extractJsonFromText(aiText) {
//   if (!aiText) return null;
//   let s = String(aiText).trim();

//   // strip triple backticks and language hints
//   s = s.replace(/^\s*```[\s\S]*?\n/, "").replace(/```$/, "").trim();

//   // find first JSON block
//   const firstBraceIdx = s.indexOf("{");
//   const lastBraceIdx = s.lastIndexOf("}");
//   if (firstBraceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > firstBraceIdx) {
//     const jsonText = s.slice(firstBraceIdx, lastBraceIdx + 1);
//     try {
//       return JSON.parse(jsonText);
//     } catch (e) {
//       // give up parse
//     }
//   }

//   // try direct parse otherwise
//   try {
//     return JSON.parse(s);
//   } catch (e) {
//     return null;
//   }
// }

// function parseCategoryResponse(aiText) {
//   const raw = (aiText || "").toString().trim();

//   // try JSON extraction
//   const parsed = extractJsonFromText(raw);
//   if (parsed && (parsed.mainCategory || parsed.category || parsed.subcategory)) {
//     // unify fields
//     const sub = parsed.subcategory || parsed.category || "";
//     const main = parsed.mainCategory || parsed.main || mapSubToMain(sub);
//     const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
//     const isPhoto = typeof parsed.isPhoto === "boolean" ? parsed.isPhoto : undefined;
//     return { subcategory: sub, mainCategory: main, confidence, isPhoto, raw };
//   }

//   // fallback regex: "Category: <X>, Confidence: <0-1>"
//   const pat = /Category[:\s]*([A-Za-z0-9 _-]+)[,;\s]*Confidence[:\s]*([0-9.]+)/i;
//   const m = raw.match(pat);
//   if (m) {
//     const sub = m[1].trim();
//     const conf = parseFloat(m[2]);
//     return { subcategory: sub, mainCategory: mapSubToMain(sub), confidence: isNaN(conf) ? 0.5 : Math.max(0, Math.min(1, conf)), raw };
//   }

//   // fallback: keyword mapping inside raw text
//   const lowered = raw.toLowerCase();
//   for (const [main, subs] of Object.entries(CATEGORY_MAP)) {
//     for (const s of subs) {
//       if (lowered.includes(s)) {
//         return { subcategory: s, mainCategory: main, confidence: 0.6, raw };
//       }
//     }
//   }

//   return { subcategory: "other", mainCategory: "Other", confidence: 0.4, raw };
// }

// /* --------------- Gemini prompts (strict, image-first instructions) --------------- */
// function buildImagePrompt() {
//   const mains = ALLOWED_MAIN_CATEGORIES.join(", ");
//   return `
// You are a civic infrastructure classifier. The available MAIN categories are: ${mains}.
// Assume the attached image is a PHOTOGRAPH taken by a citizen reporting an urban infrastructure problem (unless it's clearly an artwork/sketch — then set isPhoto:false).
// Analyze only the visible public-infrastructure problems in the image (roads, lights, water, sanitation, garbage, illegal construction, traffic signage). Do NOT hallucinate artists, paintings, people, or emotional interpretations.
// Respond STRICTLY with JSON only with keys:
// {
//   "subcategory": "<concise short label, e.g. pothole, garbage_pile, broken_footpath>",
//   "mainCategory": "<one of the MAIN categories above>",
//   "confidence": <0-1 number>,
//   "isPhoto": <true|false>,
//   "explanation": "<one-sentence explanation>"
// }
// If unsure, pick the closest MAIN category and give lower confidence.
// Examples:
// {"subcategory":"pothole","mainCategory":"Road Issues","confidence":0.92,"isPhoto":true,"explanation":"Visible large pothole in middle of road."}
// `;
// }

// function buildTextPrompt() {
//   const mains = ALLOWED_MAIN_CATEGORIES.join(", ");
//   return `
// You are a civic issues text classifier. Available MAIN categories: ${mains}.
// Given this user description, return JSON ONLY:
// {"subcategory":"<short label>","mainCategory":"<one of the main categories>","confidence":<0-1>,"explanation":"..."}
// Be concise and map subcategory to mainCategory.
// `;
// }

// /* --------------- Gemini wrappers --------------- */
// async function analyzeImageWithGemini(imageUrlOrPath) {
//   if (!geminiModel) throw new Error("Gemini model not initialized");
//   const base64 = await fetchImageBase64(imageUrlOrPath);
//   if (!base64) return { subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" };

//   const contents = [
//     { inlineData: { mimeType: "image/jpeg", data: base64 } },
//     { text: buildImagePrompt() }
//   ];

//   const response = await geminiModel.generateContent({
//     // some SDKs accept array; adapt if your SDK version differs
//     // keep temperature 0 for deterministic outputs
//     instructions: buildImagePrompt(),
//     // fallback: use older style if generateContent doesn't accept same shape
//   }, { temperature: 0.0 }).catch(err => { throw err; });

//   // Extract text from SDK's response object (SDK shapes vary; attempt common paths)
//   const aiText = (response?.response?.text?.() || response?.output?.[0]?.content || "").toString();
//   return parseCategoryResponse(aiText);
// }

// async function analyzeTextWithGemini(text) {
//   if (!geminiModel) throw new Error("Gemini model not initialized");
//   const prompt = buildTextPrompt() + "\n\nText: '''" + (text || "").replace(/'/g, "\\'") + "'''";
//   const response = await geminiModel.generateContent({
//     instructions: prompt,
//     temperature: 0.0
//   }).catch(err => { throw err; });

//   const aiText = (response?.response?.text?.() || response?.output?.[0]?.content || "").toString();
//   return parseCategoryResponse(aiText);
// }

// /* --------------- Public API: image-first orchestration --------------- */
// async function analyzeFromText(text) {
//   try {
//     if (USE_GEMINI && geminiModel) {
//       return await analyzeTextWithGemini(text);
//     }
//   } catch (err) {
//     console.warn("analyzeFromText fallback:", err?.message || err);
//   }
//   return classifyByKeywords(text);
// }

// async function analyzeFromImage(imageUrlOrPath) {
//   try {
//     if (USE_GEMINI && geminiModel) {
//       return await analyzeImageWithGemini(imageUrlOrPath);
//     }
//   } catch (err) {
//     console.warn("analyzeFromImage fallback:", err?.message || err);
//   }
//   return { subcategory: "other", mainCategory: "Other", confidence: 0.2, raw: "" };
// }

// /**
//  * analyzeAll: image-first, then text/voice as backup/validation
//  * returns { image, text, voice, best, consensus }
//  */
// async function analyzeAll({ image, text, voiceTranscript }) {
//   // run analyses (parallel where possible)
//   const [imageRes, textRes, voiceRes] = await Promise.all([
//     image ? analyzeFromImage(image).catch(() => ({ subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" })) : null,
//     text ? analyzeFromText(text).catch(() => ({ subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" })) : null,
//     voiceTranscript ? analyzeFromText(voiceTranscript).catch(() => ({ subcategory: "other", mainCategory: "Other", confidence: 0.0, raw: "" })) : null
//   ]);

//   // convert to candidate objects with weights
//   const candidates = [];
//   if (imageRes) candidates.push({ ...imageRes, source: "image", weight: IMAGE_WEIGHT, main: imageRes.mainCategory || mapSubToMain(imageRes.subcategory) });
//   if (textRes) candidates.push({ ...textRes, source: "text", weight: TEXT_WEIGHT, main: textRes.mainCategory || mapSubToMain(textRes.subcategory) });
//   if (voiceRes) candidates.push({ ...voiceRes, source: "voice", weight: VOICE_WEIGHT, main: voiceRes.mainCategory || mapSubToMain(voiceRes.subcategory) });

//   // If image exists but model says isPhoto === false, demote its weight
//   if (imageRes && typeof imageRes.isPhoto === "boolean" && imageRes.isPhoto === false) {
//     const c = candidates.find(x => x.source === "image");
//     if (c) c.weight = c.weight * 0.3; // demote artworks/sketches
//   }

//   // Choose best by weighted score = confidence * weight
//   let best = null;
//   if (candidates.length > 0) {
//     best = candidates.reduce((a, b) => (b.confidence * b.weight > a.confidence * a.weight ? b : a), candidates[0]);
//   } else {
//     best = { main: "Other", confidence: 0, source: "none" };
//   }

//   // Consensus detection: if >=2 sources have same main category
//   const counts = {};
//   for (const c of candidates) {
//     const k = (c.main || "Other").toLowerCase();
//     counts[k] = (counts[k] || 0) + 1;
//   }
//   let consensus = null;
//   for (const [k, v] of Object.entries(counts)) {
//     if (v >= 2) {
//       const cand = candidates.find(x => (x.main || "").toLowerCase() === k);
//       consensus = { mainCategory: cand.main, confidence: Math.min(1.0, cand.confidence + CONSENSUS_BOOST) };
//       break;
//     }
//   }

//   // final mapping fallback: if best.main is Other but keywords in text indicate category, prefer that
//   if ((!best.main || best.main === "Other") && textRes) {
//     const kw = classifyByKeywords(text || "");
//     if (kw && kw.mainCategory && kw.mainCategory !== "Other") {
//       best = { ...best, main: kw.mainCategory, confidence: Math.max(best.confidence, kw.confidence * 0.8), source: best.source || "text-kw" };
//     }
//   }

//   return {
//     image: imageRes,
//     text: textRes,
//     voice: voiceRes,
//     best: { mainCategory: best.main || best.mainCategory || "Other", confidence: Math.max(0, Math.min(1, best.confidence || 0)), source: best.source || "none", raw: best },
//     consensus
//   };
// }

// module.exports = {
//   analyzeFromText,
//   analyzeFromImage,
//   analyzeAll,
//   CATEGORY_MAP,
//   ALLOWED_MAIN_CATEGORIES
// };


// // const CATEGORIES=[
// //     "Garbage","Road Damage","Street Light Issue","Water Leakage","Illegal Construction","Sanitation","Traffic Storage","Other"
// // ]

// // const MAX_IMAGE_WIDTH =parseInt(process.env.AI_MAX_IMAGE_WIDTH || "1024",10);
// // const JPEG_QUALITY = parseInt(process.env.AI_JPEG_QUALITY || "78",10);
// // const AXIOS_TIMEOUT =parseInt(process.env.AI_AXIOS_TIMEOUT_MS || "120000",10);


// // const downlaodImageBuffer=async(urlOrPath)=>{
// //     if(!urlOrPath){
// //         return null
// //     }
// //     try{

// //         if (/^https?:\/\//i.test(urlOrPath)){
// //             const resp = await axios.get(urlOrPath,{
// //                 responseType:"arraybuffer",
// //                 timeout:AXIOS_TIMEOUT,
// //                 maxContentLength:Infinity,
// //                 maxBodyLength:Infinity
// //             });
// //             return Buffer.from(resp.data)
// //         }else{
// //             const abs=path.resolve(urlOrPath);
// //             if(!fs.existsSync(abs))return null
// //             return fs.readFileSync(abs)
// //         }
// //     }catch(err){
// //         console.warn("Downloading Image Buffer error",err.message || err);
// //         return null
// //     }
// // }

// // const processImageBuffer=async(buffer)=>{
// //     if(!buffer) return null;
// //     try{

// //         const processed = await sharp(buffer,{failOnError:false})
// //         .rotate()
// //         .resize({width:MAX_IMAGE_WIDTH,withoutEnlargement:true})
// //         .jpeg({quality:JPEG_QUALITY,mozjpeg:true})
// //         .toBuffer();
// //     return processed;

// //     }catch(err){
// //         console.warn("processImageBuffer error",err.message|| err)
// //         return null
// //     }
// // }

// // const fetchImageBase64=async(imageUrlorPath)=>{
// //     try{

// //         const raw = await downlaodImageBuffer(imageUrlorPath)
// //         if(!raw)return null;
// //         const processed=await processImageBuffer(raw)
// //         const final=processed || raw;
// //         return final.toString("base64");
// //     }
// //     catch(err){
// //         console.warn("fetchImageBase64 error",err.message || err);
// //         return null
// //     }
// // }

// // const classifyByKeywords=(text= "")=>{
// //     const t = (text || "").toLowerCase();
// //     if (!t) return { category: "Other", confidence: 0.15, raw: text };

// //     if (t.includes("garbage") || t.includes("trash") || t.includes("dump")) return { category: "Garbage", confidence: 0.92, raw: text };
// //     if (t.includes("pothole") || t.includes("sinkhole") || (t.includes("road") && t.includes("damage"))) return { category: "Road Damage", confidence: 0.9, raw: text };
// //     if (t.includes("light") || t.includes("lamp") || t.includes("streetlight") || t.includes("bulb")) return { category: "Street Light Issue", confidence: 0.87, raw: text };
// //     if (t.includes("leak") || t.includes("water") || t.includes("pipe")) return { category: "Water Leakage", confidence: 0.88, raw: text };
// //     if (t.includes("illegal") || t.includes("construction") || t.includes("unauthorized")) return { category: "Illegal Construction", confidence: 0.9, raw: text };
// //     if (t.includes("sanitation") || t.includes("toilet") || t.includes("sewage")) return { category: "Sanitation", confidence: 0.85, raw: text };

// //     return { category: "Other", confidence: 0.4, raw: text };
// // }

// // const parseCategoryResponse=(aiText)=>{
// //     const raw = (aiText || "").trim();
// //     // Try JSON parse
// //     try {
// //         const obj = JSON.parse(raw);
// //         if (obj && obj.category) {
// //         return {
// //             category: CATEGORIES.includes(obj.category) ? obj.category : "Other",
// //             confidence: typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0.5,
// //             raw
// //         };
// //         }
// //         } catch (_) { /* continue */ }

// //     // Try regex `Category: X, Confidence: 0.9`
// //     const pat = /Category[:\s]*([A-Za-z0-9 \-]+)[,;\s]*Confidence[:\s]*([0-9.]+)/i;
// //     const m = raw.match(pat);
// //     if (m) {
// //         const cat = m[1].trim();
// //         const conf = parseFloat(m[2]);
// //         return { category: CATEGORIES.includes(cat) ? cat : "Other", confidence: isNaN(conf) ? 0.5 : Math.max(0, Math.min(1, conf)), raw };
// //     }

// //     // Keyword fallback inside raw text
// //     const lower = raw.toLowerCase();
// //     for (const cat of CATEGORIES) {
// //         if (lower.includes(cat.toLowerCase())) return { category: cat, confidence: 0.6, raw };
// //     }

// //     return { category: "Other", confidence: 0.4, raw };
// //     }

// // const analyzeTextWithGemini=async(text)=>{
// //     if(!geminiModel)throw new Error("Gemini model not Initialized")
// //     const systemPrompt=`You are a civic-issues classifier. Categories: ${CATEGORIES.join(", ")}. Return JSON ONLY: {"category":"<one>", "confidence":<0-1>, "explanation":"..."}`;
// //     const userPrompt = `Text: """${text.replace(/"/g, '\\"')}"""`;

// //     const result = await geminiModel.generateContent({
// //     instructions: systemPrompt + "\n\n" + userPrompt,
// //     temperature: 0.0
// //     });

// //     const aiText=result?.response?.text?.() || result?.output?.[0]?.content || "";
// //     return parseCategoryResponse(aiText)
// // }

// // const analyzeImageWithGemini=async(imageUrlOrPath)=>{
// //     if(!geminiModel)throw new Error("Gemini model Not Initialized")
// //     const base64 = await fetchImageBase64(imageUrlOrPath);  
// //     if(!base64)return {category:"Other",confidence:0.0,raw:""}

// //     const response=await geminiModel.generateContent([
// //         { inlineData: { mimeType: "image/jpeg", data: base64 } },
// //         { text: `Analyze the image and return JSON ONLY: {"category":"<one>", "confidence":<0-1>, "explanation":"..."}` }
// //     ])
    
// //     const aiText=response?.response?.text?.() || "";
// //     return parseCategoryResponse(aiText)

// // }


// // const analyzeFromImage=async(imageUrlOrPath)=>{
// //     try{

// //     if (USE_GEMINI && geminiModel) return await analyzeImageWithGemini(imageUrlOrPath);
// //     return { category: "Other", confidence: 0.2, raw: "" };
    
// //     }catch(err){

// //     console.warn("analyzeFromImage fallback:", err.message || err);
// //     return { category: "Other", confidence: 0.2, raw: "" };

// //     }

// // }


// // const analyzeAll=async({ image, text, voiceTranscript })=>{
// //     const results = { image: null, text: null, voice: null };

// //     if (image) results.image = await analyzeFromImage(image).catch(() => ({ category: "Other", confidence: 0.0, raw: "" }));
// //     if (text) results.text = await analyzeTextWithGemini (text).catch(() => ({ category: "Other", confidence: 0.0, raw: "" }));
// //     if (voiceTranscript) results.voice = await analyzeTextWithGemini(voiceTranscript).catch(() => ({ category: "Other", confidence: 0.0, raw: "" }));

// //     const candidates = [];
// //     if (results.image) candidates.push({ ...results.image, source: "image" });
// //     if (results.text) candidates.push({ ...results.text, source: "text" });
// //     if (results.voice) candidates.push({ ...results.voice, source: "voice" });

    
// //     let best = { category: "Other", confidence: 0, source: "none" };
// //     if (candidates.length) best = candidates.reduce((a, b) => (b.confidence > a.confidence ? b : a), candidates[0]);


// //     const counts = {};
// //     for (const c of candidates) {
// //     const k = (c.category || "Other").toLowerCase();
// //     counts[k] = (counts[k] || 0) + 1;
// //     }
// //     let consensus = null;
// //     for (const [k, v] of Object.entries(counts)) {
// //     if (v >= 2) {
// //         const cand = candidates.find(x => (x.category || "").toLowerCase() === k);
// //         consensus = { category: cand.category, confidence: Math.min(1, cand.confidence + 0.15) };
// //         break;
// //     }
// //     }

// //     return { image: results.image, text: results.text, voice: results.voice, best, consensus };

// // }

// // module.exports = {analyzeTextWithGemini , analyzeFromImage, analyzeAll, CATEGORIES };