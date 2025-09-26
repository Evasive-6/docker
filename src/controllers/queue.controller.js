const reportQueue = require('../workers/reportQueue');
const Report = require('../models/Report');

// Get AI processing queue status and statistics
const getQueueStatus = async (req, res) => {
    try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            reportQueue.getWaiting(),
            reportQueue.getActive(),
            reportQueue.getCompleted(),
            reportQueue.getFailed(),
            reportQueue.getDelayed()
        ]);

        const stats = {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
            total: waiting.length + active.length + completed.length + failed.length + delayed.length
        };

        // Get recent jobs for monitoring
        const recentJobs = [...active, ...waiting.slice(0, 5)].map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            progress: job.progress(),
            createdAt: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason
        }));

        res.json({
            success: true,
            queueStats: stats,
            recentJobs,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Get queue status error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Manually queue specific report for AI processing
const processReport = async (req, res) => {
    try {
        const { reportId } = req.body;

        if (!reportId) {
            return res.status(400).json({
                success: false,
                message: 'Report ID is required'
            });
        }

        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Add job to queue
        const job = await reportQueue.add(
            'processReport',
            { reportId: reportId.toString() },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: false
            }
        );

        res.json({
            success: true,
            message: 'Report queued for processing',
            jobId: job.id,
            reportId
        });
    } catch (error) {
        console.error('Process report error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Process multiple reports in batch
const processBatch = async (req, res) => {
    try {
        const { reportIds, priority = 'normal' } = req.body;

        if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Report IDs array is required'
            });
        }

        if (reportIds.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 100 reports can be processed in a single batch'
            });
        }

        const validReports = await Report.find({ 
            _id: { $in: reportIds } 
        }).select('_id');

        const jobs = [];
        for (const report of validReports) {
            const job = await reportQueue.add(
                'processReport',
                { reportId: report._id.toString() },
                {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5000 },
                    removeOnComplete: true,
                    removeOnFail: false,
                    priority: priority === 'high' ? 1 : priority === 'low' ? -1 : 0
                }
            );
            jobs.push(job.id);
        }

        res.json({
            success: true,
            message: `${validReports.length} reports queued for batch processing`,
            jobIds: jobs,
            requestedCount: reportIds.length,
            queuedCount: validReports.length
        });
    } catch (error) {
        console.error('Process batch error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Retry all failed AI processing jobs
const retryFailed = async (req, res) => {
    try {
        const failedJobs = await reportQueue.getFailed();
        
        if (failedJobs.length === 0) {
            return res.json({
                success: true,
                message: 'No failed jobs to retry',
                retriedCount: 0
            });
        }

        let retriedCount = 0;
        for (const job of failedJobs) {
            try {
                await job.retry();
                retriedCount++;
            } catch (retryError) {
                console.warn(`Failed to retry job ${job.id}:`, retryError.message);
            }
        }

        res.json({
            success: true,
            message: `${retriedCount} failed jobs queued for retry`,
            totalFailed: failedJobs.length,
            retriedCount
        });
    } catch (error) {
        console.error('Retry failed jobs error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Get specific processing job details
const getJobDetails = async (req, res) => {
    try {
        const { jobId } = req.params;

        const job = await reportQueue.getJob(jobId);
        
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        const jobDetails = {
            id: job.id,
            name: job.name,
            data: job.data,
            opts: job.opts,
            progress: job.progress(),
            delay: job.delay,
            timestamp: job.timestamp,
            attemptsMade: job.attemptsMade,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
            returnvalue: job.returnvalue,
            stacktrace: job.stacktrace
        };

        res.json({
            success: true,
            job: jobDetails
        });
    } catch (error) {
        console.error('Get job details error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Clear failed jobs from processing queue
const clearFailedJobs = async (req, res) => {
    try {
        const { olderThan = 24 } = req.query; // Hours
        const cutoffTime = Date.now() - (parseInt(olderThan) * 60 * 60 * 1000);

        const failedJobs = await reportQueue.getFailed();
        let removedCount = 0;

        for (const job of failedJobs) {
            if (job.timestamp < cutoffTime) {
                await job.remove();
                removedCount++;
            }
        }

        res.json({
            success: true,
            message: `${removedCount} failed jobs removed`,
            totalFailed: failedJobs.length,
            removedCount
        });
    } catch (error) {
        console.error('Clear failed jobs error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

// Clear completed jobs (keeps last 10)
const clearCompletedJobs = async (req, res) => {
    try {
        const { keepLast = 10 } = req.query;
        
        const completedJobs = await reportQueue.getCompleted();
        
        if (completedJobs.length <= parseInt(keepLast)) {
            return res.json({
                success: true,
                message: 'No completed jobs to clear',
                totalCompleted: completedJobs.length,
                removedCount: 0
            });
        }

        // Sort by completion time and remove older ones
        const sortedJobs = completedJobs.sort((a, b) => (b.finishedOn || 0) - (a.finishedOn || 0));
        const jobsToRemove = sortedJobs.slice(parseInt(keepLast));
        
        let removedCount = 0;
        for (const job of jobsToRemove) {
            await job.remove();
            removedCount++;
        }

        res.json({
            success: true,
            message: `${removedCount} completed jobs removed (kept last ${keepLast})`,
            totalCompleted: completedJobs.length,
            removedCount
        });
    } catch (error) {
        console.error('Clear completed jobs error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

module.exports = {
    getQueueStatus,
    processReport,
    processBatch,
    retryFailed,
    getJobDetails,
    clearFailedJobs,
    clearCompletedJobs
};