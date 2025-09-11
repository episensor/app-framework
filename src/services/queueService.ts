/**
 * Queue Service for background job processing
 * Based on patterns from mila-ai but enhanced with TypeScript and better error handling
 */

import { EventEmitter } from 'events';
import { createLogger } from '../core/index.js';
import { getStorageService } from '../core/storageService.js';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('QueueService');
  }
  return logger;
}

export interface QueueJob {
  id: string;
  type: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  error?: string;
}

export interface QueueConfig {
  maxConcurrentJobs?: number;
  pollingInterval?: number;
  maxRetries?: number;
  enablePersistence?: boolean;
}

export type JobHandler = (job: QueueJob) => Promise<void>;

export class QueueService extends EventEmitter {
  private jobs: Map<string, QueueJob>;
  private handlers: Map<string, JobHandler>;
  private isRunning: boolean;
  private activeJobs: number;
  private config: Required<QueueConfig>;
  private pollingTimer?: NodeJS.Timeout;
  private fileHandler = getStorageService();

  constructor(config: QueueConfig = {}) {
    super();
    
    this.config = {
      maxConcurrentJobs: config.maxConcurrentJobs || 3,
      pollingInterval: config.pollingInterval || 5000,
      maxRetries: config.maxRetries || 3,
      enablePersistence: config.enablePersistence || false
    };

    this.jobs = new Map();
    this.handlers = new Map();
    this.isRunning = false;
    this.activeJobs = 0;

    ensureLogger().debug('QueueService initialized', this.config);
  }

  /**
   * Register a job handler
   */
  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
    ensureLogger().debug(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Add a job to the queue
   */
  async addJob(type: string, data: any, priority: number = 0): Promise<string> {
    const jobId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: QueueJob = {
      id: jobId,
      type,
      data,
      status: 'pending',
      priority,
      retries: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.jobs.set(jobId, job);
    
    if (this.config.enablePersistence) {
      await this.persistJob(job);
    }

    this.emit('job:added', job);
    ensureLogger().info(`Added job ${jobId} of type ${type}`);

    // Check if this is a high-priority job that should preempt current processing
    if (this.isRunning && priority > 5) {
      // Check if we have capacity and if new job has higher priority than any processing job
      const processingJobs = Array.from(this.jobs.values())
        .filter(j => j.status === 'processing');
      
      if (this.activeJobs < this.config.maxConcurrentJobs) {
        // We have free workers, process immediately
        this.processNextJob();
      } else if (processingJobs.some(j => j.priority < priority)) {
        // New job has higher priority than some processing jobs
        ensureLogger().info(`High priority job ${jobId} added, triggering immediate processing`);
        this.processNextJob();
      }
    } else if (this.isRunning) {
      // Normal priority job, process normally
      this.processNextJob();
    }

    return jobId;
  }

  /**
   * Start processing jobs
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      ensureLogger().warn('Queue is already running');
      return;
    }

    this.isRunning = true;
    ensureLogger().debug('Starting queue processing');

    if (this.config.enablePersistence) {
      await this.loadPersistedJobs();
    }

    this.startPolling();
    this.emit('queue:started');
  }

  /**
   * Stop processing jobs
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      ensureLogger().warn('Queue is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    ensureLogger().info('Stopping queue processing');
    
    // Wait for active jobs to complete
    while (this.activeJobs > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.emit('queue:stopped');
    ensureLogger().info('Queue processing stopped');
  }

  /**
   * Process the next job in the queue
   */
  private async processNextJob(): Promise<void> {
    if (!this.isRunning) return;
    
    if (this.activeJobs >= this.config.maxConcurrentJobs) {
      ensureLogger().debug(`Max concurrent jobs reached (${this.activeJobs}/${this.config.maxConcurrentJobs})`);
      return;
    }

    const job = this.getNextPendingJob();
    if (!job) {
      ensureLogger().debug('No pending jobs found');
      return;
    }

    const handler = this.handlers.get(job.type);
    if (!handler) {
      ensureLogger().error(`No handler registered for job type: ${job.type}`);
      await this.failJob(job, 'No handler registered');
      return;
    }

    this.activeJobs++;
    job.status = 'processing';
    job.processedAt = new Date();
    job.updatedAt = new Date();

    ensureLogger().info(`Processing job ${job.id} (${job.type}), Active: ${this.activeJobs}`);
    this.emit('job:started', job);

    try {
      await handler(job);
      await this.completeJob(job);
    } catch (_error: any) {
      await this.handleJobError(job, _error);
    } finally {
      this.activeJobs--;
      
      // Process next job immediately if available
      if (this.isRunning) {
        setImmediate(() => this.processNextJob());
      }
    }
  }

  /**
   * Get the next pending job based on priority
   */
  private getNextPendingJob(): QueueJob | null {
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => {
        // Higher priority first
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Earlier jobs first
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    return pendingJobs[0] || null;
  }

  /**
   * Mark a job as completed
   */
  private async completeJob(job: QueueJob): Promise<void> {
    job.status = 'completed';
    job.updatedAt = new Date();
    
    ensureLogger().info(`Job ${job.id} completed successfully`);
    this.emit('job:completed', job);

    if (this.config.enablePersistence) {
      await this.persistJob(job);
    }

    // Remove completed jobs after some time to prevent memory leak
    setTimeout(() => {
      this.jobs.delete(job.id);
    }, 60000); // Keep for 1 minute
  }

  /**
   * Handle job error
   */
  private async handleJobError(job: QueueJob, error: Error): Promise<void> {
    job.retries++;
    job.error = error.message;
    job.updatedAt = new Date();

    ensureLogger().error(`Job ${job.id} failed: ${error.message}`, error);

    if (job.retries < job.maxRetries) {
      job.status = 'pending'; // Retry
      ensureLogger().info(`Job ${job.id} will be retried (${job.retries}/${job.maxRetries})`);
      this.emit('job:retry', job);
    } else {
      await this.failJob(job, error.message);
    }

    if (this.config.enablePersistence) {
      await this.persistJob(job);
    }
  }

  /**
   * Mark a job as failed
   */
  private async failJob(job: QueueJob, reason: string): Promise<void> {
    job.status = 'failed';
    job.error = reason;
    job.updatedAt = new Date();
    
    ensureLogger().error(`Job ${job.id} failed permanently: ${reason}`);
    this.emit('job:failed', job);

    if (this.config.enablePersistence) {
      // Move failed job to dead-letter queue directory
      await this.moveToDeadLetterQueue(job);
    }
  }

  /**
   * Move failed job to dead-letter queue
   */
  private async moveToDeadLetterQueue(job: QueueJob): Promise<void> {
    try {
      // Save to data directory with failed_ prefix
      await this.fileHandler.saveFile(
        `failed_${job.id}_${Date.now()}.json`,
        JSON.stringify(job, null, 2),
        'data',
        { overwrite: true }
      );
      
      // Remove original queue file from main queue directory
      await this.fileHandler.deleteFile(
        `queue_${job.id}.json`,
        'data'
      );
      
      ensureLogger().info(`Moved failed job ${job.id} to dead-letter queue`);
    } catch (_error) {
      ensureLogger().error('Failed to move job to dead-letter queue:', _error);
    }
  }

  /**
   * Start polling for jobs
   */
  private startPolling(): void {
    this.pollingTimer = setInterval(() => {
      this.processNextJob();
    }, this.config.pollingInterval);

    // Process immediately
    this.processNextJob();
  }

  /**
   * Persist job to file
   */
  private async persistJob(job: QueueJob): Promise<void> {
    try {
      await this.fileHandler.saveFile(
        `queue_${job.id}.json`,
        JSON.stringify(job, null, 2),
        'data',
        { overwrite: true }
      );
    } catch (_error) {
      ensureLogger().error('Failed to persist job', _error);
    }
  }

  /**
   * Load persisted jobs
   */
  private async loadPersistedJobs(): Promise<void> {
    try {
      const files = await this.fileHandler.listFiles('data', /^queue_.*\.json$/);
      
      for (const file of files) {
        try {
          const content = await this.fileHandler.readFile(file.name, 'data');
          const job = JSON.parse(content.toString());
          
          // Convert date strings back to Date objects
          job.createdAt = new Date(job.createdAt);
          job.updatedAt = new Date(job.updatedAt);
          if (job.processedAt) {
            job.processedAt = new Date(job.processedAt);
          }

          // Reset processing jobs to pending
          if (job.status === 'processing') {
            job.status = 'pending';
          }

          this.jobs.set(job.id, job);
        } catch (_error) {
          ensureLogger().error(`Failed to load job from ${file.name}`, _error);
        }
      }

      ensureLogger().debug(`Loaded ${this.jobs.size} persisted jobs`);
    } catch (_error) {
      ensureLogger().error('Failed to load persisted jobs', _error);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    activeJobs: number;
  } {
    const jobs = Array.from(this.jobs.values());
    
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      activeJobs: this.activeJobs
    };
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): QueueJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Clear completed and failed jobs
   */
  clearFinishedJobs(): void {
    for (const [id, job] of this.jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobs.delete(id);
      }
    }
    ensureLogger().info('Cleared finished jobs');
  }
}

export default QueueService;