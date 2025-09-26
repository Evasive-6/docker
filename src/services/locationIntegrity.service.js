const ExifReader = require('exifreader');

/**
 * Location Integrity Service
 * Validates that photos are captured live with accurate location data
 */

class LocationIntegrityService {
    /**
     * Extract EXIF data from image buffer
     * @param {Buffer} imageBuffer - Image file buffer
     * @returns {Object} EXIF data including GPS coordinates and timestamp
     */
    static extractExifData(imageBuffer) {
        try {
            const tags = ExifReader.load(imageBuffer);
            
            const exifData = {
                hasGPS: false,
                gpsCoordinates: null,
                timestamp: null,
                cameraInfo: {},
                isLivePhoto: false
            };

            // Extract GPS coordinates
            if (tags.GPSLatitude && tags.GPSLongitude) {
                const lat = this.convertGPSToDecimal(
                    tags.GPSLatitude.description,
                    tags.GPSLatitudeRef?.description
                );
                const lng = this.convertGPSToDecimal(
                    tags.GPSLongitude.description,
                    tags.GPSLongitudeRef?.description
                );
                
                if (lat !== null && lng !== null) {
                    exifData.hasGPS = true;
                    exifData.gpsCoordinates = { lat, lng };
                }
            }

            // Extract timestamp
            if (tags.DateTime || tags.DateTimeOriginal) {
                const dateTime = tags.DateTimeOriginal?.description || tags.DateTime?.description;
                if (dateTime) {
                    exifData.timestamp = new Date(dateTime.replace(/:/g, '-').replace(/ /, 'T'));
                }
            }

            // Extract camera info to help determine if live photo
            exifData.cameraInfo = {
                make: tags.Make?.description,
                model: tags.Model?.description,
                software: tags.Software?.description,
                imageWidth: tags.ImageWidth?.description,
                imageHeight: tags.ImageHeight?.description
            };

            // Check if photo appears to be live/recent
            exifData.isLivePhoto = this.isPhotoLive(exifData.timestamp);

            return exifData;
        } catch (error) {
            console.error('EXIF extraction error:', error);
            return {
                hasGPS: false,
                gpsCoordinates: null,
                timestamp: null,
                cameraInfo: {},
                isLivePhoto: false,
                error: error.message
            };
        }
    }

    /**
     * Convert GPS coordinates from EXIF format to decimal
     * @param {string} coordinate - GPS coordinate string
     * @param {string} ref - GPS reference (N/S for latitude, E/W for longitude)
     * @returns {number|null} Decimal coordinate
     */
    static convertGPSToDecimal(coordinate, ref) {
        try {
            if (!coordinate) return null;
            
            // Parse coordinate string like "28° 36' 50.04""
            const parts = coordinate.match(/(\d+)°\s*(\d+)'\s*([\d.]+)"/);
            if (!parts) return null;

            const degrees = parseInt(parts[1]);
            const minutes = parseInt(parts[2]);
            const seconds = parseFloat(parts[3]);

            let decimal = degrees + (minutes / 60) + (seconds / 3600);
            
            // Apply reference (negative for South/West)
            if (ref === 'S' || ref === 'W') {
                decimal = -decimal;
            }

            return decimal;
        } catch (error) {
            console.error('GPS conversion error:', error);
            return null;
        }
    }

    /**
     * Check if photo appears to be taken recently (live photo)
     * @param {Date} timestamp - Photo timestamp
     * @returns {boolean} True if photo appears live
     */
    static isPhotoLive(timestamp) {
        if (!timestamp) return false;
        
        const now = new Date();
        const timeDiff = Math.abs(now - timestamp);
        const maxAllowedAge = 5 * 60 * 1000; // 5 minutes

        return timeDiff <= maxAllowedAge;
    }

    /**
     * Validate location integrity between claimed location and EXIF data
     * @param {Object} claimedLocation - Location provided by user
     * @param {Object} exifData - EXIF data from photo
     * @param {number} toleranceMeters - Allowed distance tolerance in meters
     * @returns {Object} Validation result
     */
    static validateLocationIntegrity(claimedLocation, exifData, toleranceMeters = 100) {
        const result = {
            isValid: false,
            hasGPSData: exifData.hasGPS,
            isLivePhoto: exifData.isLivePhoto,
            distanceDifference: null,
            issues: []
        };

        // Check if photo has GPS data
        if (!exifData.hasGPS) {
            result.issues.push('Photo does not contain GPS location data');
            return result;
        }

        // Check if photo is recent (live)
        if (!exifData.isLivePhoto) {
            result.issues.push('Photo appears to be old or not taken recently');
        }

        // Calculate distance between claimed and EXIF locations
        if (exifData.gpsCoordinates && claimedLocation.coordinates) {
            const distance = this.calculateDistance(
                claimedLocation.coordinates[1], // lat
                claimedLocation.coordinates[0], // lng
                exifData.gpsCoordinates.lat,
                exifData.gpsCoordinates.lng
            );

            result.distanceDifference = distance;

            if (distance > toleranceMeters) {
                result.issues.push(`Location mismatch: ${distance.toFixed(2)}m difference (tolerance: ${toleranceMeters}m)`);
            }
        }

        // Photo is valid if it has GPS, is live, and location matches
        result.isValid = exifData.hasGPS && 
                        exifData.isLivePhoto && 
                        (result.distanceDifference === null || result.distanceDifference <= toleranceMeters);

        return result;
    }

    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     * @param {number} lat1 - Latitude 1
     * @param {number} lon1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lon2 - Longitude 2
     * @returns {number} Distance in meters
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
}

module.exports = LocationIntegrityService;
