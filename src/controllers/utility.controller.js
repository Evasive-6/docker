const AWS = require('aws-sdk');

// Configure AWS SDK for MinIO/S3
const s3 = new AWS.S3({
    endpoint: process.env.MINIO_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    s3ForcePathStyle: true,
    signatureVersion: 'v4'
});

// Generate presigned URL for report file uploads
const generatePresignedUrl = async (req, res) => {
    try {
        const { filename, filetype, folder = 'reports' } = req.query;
        const userId = req.user.id;

        if (!filename || !filetype) {
            return res.status(400).json({
                success: false,
                message: 'Filename and filetype are required'
            });
        }

        // Validate file type
        const allowedTypes = [
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/avi',
            'video/mov',
            'audio/mp3',
            'audio/wav',
            'audio/aac'
        ];

        if (!allowedTypes.includes(filetype.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'File type not supported'
            });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const fileExtension = filename.split('.').pop();
        const key = `${folder}/${userId}/${timestamp}_${randomString}.${fileExtension}`;

        // Generate presigned URL
        const params = {
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Expires: 60 * 5, // 5 minutes
            ContentType: filetype,
            ACL: 'public-read'
        };

        const uploadUrl = s3.getSignedUrl('putObject', params);
        const publicUrl = process.env.S3_PUBLIC_URL 
            ? `${process.env.S3_PUBLIC_URL}/${key}`
            : `${process.env.MINIO_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;

        res.json({
            success: true,
            uploadUrl,
            publicUrl,
            key,
            expiresIn: 300 // 5 minutes in seconds
        });

    } catch (error) {
        console.error('Generate presigned URL error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate upload URL'
        });
    }
};

module.exports = {
    generatePresignedUrl
};