/**
 * Unit tests for QueueService - Simplified without timers
 */

import { QueueService, QueueJob, QueueConfig, JobHandler } from '../../../src/services/queueService';

// Mock dependencies
jest.mock('../../../src/core', () => ({
  ...jest.requireActual('../../../src/core'),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// Create a mock file handler that we can reference
const mockFileHandler = {
  saveFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('{}'),
  listFiles: jest.fn().mockResolvedValue([])
};

jest.mock('../../../src/core/storageService', () => ({
  getStorageService: jest.fn(() => mockFileHandler)
}));

describe('QueueService', () => {
  let queueService: QueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    queueService = new QueueService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    test('creates instance with default config', () => {
      expect(queueService).toBeDefined();
      expect(queueService['config']).toEqual({
        maxConcurrentJobs: 3,
        pollingInterval: 5000,
        maxRetries: 3,
        enablePersistence: false
      });
    });

    test('creates instance with custom config', () => {
      const config: QueueConfig = {
        maxConcurrentJobs: 5,
        pollingInterval: 10000,
        maxRetries: 5,
        enablePersistence: true
      };

      const customQueue = new QueueService(config);
      
      expect(customQueue['config']).toEqual({
        maxConcurrentJobs: 5,
        pollingInterval: 10000,
        maxRetries: 5,
        enablePersistence: true
      });
    });
  });

  describe('registerHandler', () => {
    test('registers job handler successfully', () => {
      const handler: JobHandler = jest.fn();
      
      queueService.registerHandler('test-job', handler);
      
      expect(queueService['handlers'].has('test-job')).toBe(true);
      expect(queueService['handlers'].get('test-job')).toBe(handler);
    });

    test('registers multiple handlers', () => {
      const handler1: JobHandler = jest.fn();
      const handler2: JobHandler = jest.fn();
      
      queueService.registerHandler('job-type-1', handler1);
      queueService.registerHandler('job-type-2', handler2);
      
      expect(queueService['handlers'].size).toBe(2);
    });

    test('overwrites existing handler', () => {
      const handler1: JobHandler = jest.fn();
      const handler2: JobHandler = jest.fn();
      
      queueService.registerHandler('test-job', handler1);
      queueService.registerHandler('test-job', handler2);
      
      expect(queueService['handlers'].get('test-job')).toBe(handler2);
    });
  });

  describe('addJob', () => {
    test('adds job to queue successfully', async () => {
      const jobId = await queueService.addJob('test-job', { value: 'test-data' });
      
      expect(jobId).toBeDefined();
      expect(jobId).toContain('test-job_');
      
      const job = queueService['jobs'].get(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe('test-job');
      expect(job?.data).toEqual({ value: 'test-data' });
      expect(job?.status).toBe('pending');
      expect(job?.priority).toBe(0);
      expect(job?.retries).toBe(0);
    });

    test('adds job with custom priority', async () => {
      const jobId = await queueService.addJob('priority-job', { data: 'test' }, 10);
      
      const job = queueService['jobs'].get(jobId);
      expect(job?.priority).toBe(10);
    });

    test('emits job:added event', async () => {
      const listener = jest.fn();
      queueService.on('job:added', listener);
      
      await queueService.addJob('test-job', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-job',
          status: 'pending'
        })
      );
    });

    test('persists job when persistence enabled', async () => {
      const persistQueue = new QueueService({ enablePersistence: true });
      const fileHandler = persistQueue['fileHandler'];
      
      await persistQueue.addJob('persist-job', { data: 'test' });
      
      expect(fileHandler.saveFile).toHaveBeenCalled();
    });

    test('triggers processing if queue is running', async () => {
      queueService['isRunning'] = true;
      const processSpy = jest.spyOn(queueService as any, 'processNextJob').mockImplementation();
      
      await queueService.addJob('test-job', { data: 'test' });
      
      expect(processSpy).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    test('starts queue processing', async () => {
      const listener = jest.fn();
      queueService.on('queue:started', listener);
      
      await queueService.start();
      
      expect(queueService['isRunning']).toBe(true);
      expect(listener).toHaveBeenCalled();
      
      // Clean up
      queueService['isRunning'] = false;
      if (queueService['pollingTimer']) {
        clearInterval(queueService['pollingTimer']);
        queueService['pollingTimer'] = undefined;
      }
    });

    test('does not start if already running', async () => {
      queueService['isRunning'] = true;
      const listener = jest.fn();
      queueService.on('queue:started', listener);
      
      await queueService.start();
      
      expect(listener).not.toHaveBeenCalled();
    });

    test('loads persisted jobs when persistence enabled', async () => {
      const persistQueue = new QueueService({ enablePersistence: true });
      const fileHandler = persistQueue['fileHandler'];
      
      const persistedJob = {
        id: 'persisted-1',
        type: 'persisted-job',
        status: 'pending',
        data: { test: 'data' },
        priority: 0,
        retries: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      fileHandler.listFiles = jest.fn().mockResolvedValue(['job_persisted-1.json']);
      fileHandler.readFile = jest.fn().mockResolvedValue(JSON.stringify(persistedJob));
      
      await persistQueue.start();
      
      expect(fileHandler.listFiles).toHaveBeenCalled();
      expect(fileHandler.readFile).toHaveBeenCalled();
      
      // Clean up
      persistQueue['isRunning'] = false;
      if (persistQueue['pollingTimer']) {
        clearInterval(persistQueue['pollingTimer']);
      }
    });
  });

  describe('stop', () => {
    test('stops queue processing', async () => {
      queueService['isRunning'] = true;
      queueService['pollingTimer'] = setInterval(() => {}, 1000);
      
      const listener = jest.fn();
      queueService.on('queue:stopped', listener);
      
      await queueService.stop();
      
      expect(queueService['isRunning']).toBe(false);
      expect(queueService['pollingTimer']).toBeUndefined();
      expect(listener).toHaveBeenCalled();
    });

    test('does not stop if not running', async () => {
      const listener = jest.fn();
      queueService.on('queue:stopped', listener);
      
      await queueService.stop();
      
      expect(listener).not.toHaveBeenCalled();
    });

    test('waits for active jobs', async () => {
      queueService['isRunning'] = true;
      queueService['activeJobs'] = 1;
      
      // Mock the wait loop
      let waitCount = 0;
      const originalSetTimeout = global.setTimeout;
      (global as any).setTimeout = jest.fn((callback: any) => {
        waitCount++;
        if (waitCount > 2) {
          queueService['activeJobs'] = 0;
        }
        callback();
        return {} as any;
      }) as any;
      
      await queueService.stop();
      
      expect(queueService['isRunning']).toBe(false);
      
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('getJob', () => {
    test('returns job by ID', async () => {
      const jobId = await queueService.addJob('get-job', { test: 'data' });
      
      const job = queueService.getJob(jobId);
      
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.type).toBe('get-job');
      expect(job?.data).toEqual({ test: 'data' });
    });

    test('returns undefined for non-existent job', () => {
      const job = queueService.getJob('non-existent');
      
      expect(job).toBeUndefined();
    });
  });

  describe('getAllJobs', () => {
    test('returns all jobs', async () => {
      await queueService.addJob('job1', { index: 1 });
      await queueService.addJob('job2', { index: 2 });
      await queueService.addJob('job3', { index: 3 });
      
      const jobs = queueService.getAllJobs();
      
      expect(jobs).toHaveLength(3);
      expect(jobs.map(j => j.type)).toContain('job1');
      expect(jobs.map(j => j.type)).toContain('job2');
      expect(jobs.map(j => j.type)).toContain('job3');
    });

    test('returns empty array when no jobs', () => {
      const jobs = queueService.getAllJobs();
      
      expect(jobs).toEqual([]);
    });
  });

  describe('getStats', () => {
    test('returns queue statistics', async () => {
      await queueService.addJob('stats-job', {});
      await queueService.addJob('stats-job', {});
      
      // Manually set job statuses
      const jobs = Array.from(queueService['jobs'].values());
      jobs[0].status = 'completed';
      jobs[1].status = 'failed';
      
      await queueService.addJob('stats-job', {}); // This will be pending
      
      const stats = queueService.getStats();
      
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });

    test('returns empty stats when no jobs', () => {
      const stats = queueService.getStats();
      
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('clearFinishedJobs', () => {
    test('removes completed and failed jobs', async () => {
      const completedId = await queueService.addJob('completed-job', {});
      const failedId = await queueService.addJob('failed-job', {});
      const pendingId = await queueService.addJob('pending-job', {});
      
      // Set job statuses
      const completedJob = queueService['jobs'].get(completedId)!;
      completedJob.status = 'completed';
      
      const failedJob = queueService['jobs'].get(failedId)!;
      failedJob.status = 'failed';
      
      queueService.clearFinishedJobs();
      
      expect(queueService.getJob(completedId)).toBeUndefined();
      expect(queueService.getJob(failedId)).toBeUndefined();
      expect(queueService.getJob(pendingId)).toBeDefined();
    });

    test('does nothing when no finished jobs', async () => {
      await queueService.addJob('pending1', {});
      await queueService.addJob('pending2', {});
      
      const jobsBefore = queueService.getAllJobs().length;
      queueService.clearFinishedJobs();
      const jobsAfter = queueService.getAllJobs().length;
      
      expect(jobsAfter).toBe(jobsBefore);
    });
  });

  describe('private methods coverage', () => {
    test('processNextJob handles no pending jobs', async () => {
      queueService['isRunning'] = true;
      await queueService['processNextJob']();
      // Should not throw
    });

    test('processNextJob respects max concurrent jobs', async () => {
      queueService['isRunning'] = true;
      queueService['activeJobs'] = 3;
      queueService['config'].maxConcurrentJobs = 3;
      
      await queueService.addJob('test', {});
      await queueService['processNextJob']();
      
      // Should not process due to max concurrent
      expect(queueService['activeJobs']).toBe(3);
    });

    test('getNextPendingJob returns highest priority job', async () => {
      await queueService.addJob('low', {}, 1);
      await queueService.addJob('high', {}, 10);
      await queueService.addJob('medium', {}, 5);
      
      const nextJob = queueService['getNextPendingJob']();
      
      expect(nextJob?.priority).toBe(10);
    });

    test('getNextPendingJob returns null when no pending jobs', () => {
      const nextJob = queueService['getNextPendingJob']();
      expect(nextJob).toBeNull();
    });

    test('failJob sets job status to failed', async () => {
      const jobId = await queueService.addJob('fail-test', {});
      const job = queueService['jobs'].get(jobId)!;
      
      await queueService['failJob'](job, 'Test error');
      
      expect(job.status).toBe('failed');
      expect(job.error).toBe('Test error');
    });

    test('completeJob sets job status to completed', async () => {
      const jobId = await queueService.addJob('complete-test', {});
      const job = queueService['jobs'].get(jobId)!;
      
      await queueService['completeJob'](job);
      
      expect(job.status).toBe('completed');
    });

    test('handleJobError retries job if under max retries', async () => {
      const jobId = await queueService.addJob('retry-test', {});
      const job = queueService['jobs'].get(jobId)!;
      job.retries = 1;
      job.maxRetries = 3;
      
      await queueService['handleJobError'](job, new Error('Retry error'));
      
      expect(job.status).toBe('pending');
      expect(job.retries).toBe(2);
    });

    test('handleJobError fails job after max retries', async () => {
      const jobId = await queueService.addJob('max-retry-test', {});
      const job = queueService['jobs'].get(jobId)!;
      job.retries = 2;
      job.maxRetries = 3;
      
      await queueService['handleJobError'](job, new Error('Final error'));
      
      expect(job.status).toBe('failed');
      expect(job.retries).toBe(3);
    });

    test('startPolling creates interval timer', () => {
      queueService['startPolling']();
      
      expect(queueService['pollingTimer']).toBeDefined();
      
      // Clean up
      clearInterval(queueService['pollingTimer']!);
    });

    test('persistJob saves job to file', async () => {
      // Clear previous calls
      mockFileHandler.saveFile.mockClear();
      
      const persistService = new QueueService({ enablePersistence: true });
      const job: QueueJob = {
        id: 'test-id',
        type: 'test',
        data: {},
        status: 'pending',
        priority: 0,
        retries: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await persistService['persistJob'](job);
      
      expect(mockFileHandler.saveFile).toHaveBeenCalledWith(
        'queue_test-id.json',
        expect.any(String),
        'data',
        { overwrite: true }
      );
    });

    test('loadPersistedJobs handles errors gracefully', async () => {
      const persistQueue = new QueueService({ enablePersistence: true });
      const fileHandler = persistQueue['fileHandler'];
      
      fileHandler.listFiles = jest.fn().mockRejectedValue(new Error('Read error'));
      
      await persistQueue['loadPersistedJobs']();
      // Should not throw
    });
  });
});