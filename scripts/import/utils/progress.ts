export class ProgressTracker {
  private current: number = 0;
  private total: number;
  private startTime: number;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 1000; // Update every 1 second

  constructor(
    private name: string,
    total: number,
    private showETA: boolean = true
  ) {
    this.total = total;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
  }

  /**
   * Update progress
   */
  update(increment: number = 1): void {
    this.current += increment;
    
    const now = Date.now();
    if (now - this.lastUpdateTime >= this.updateInterval || this.current >= this.total) {
      this.display();
      this.lastUpdateTime = now;
    }
  }

  /**
   * Set current progress directly
   */
  setCurrent(current: number): void {
    this.current = current;
    this.display();
  }

  /**
   * Display current progress
   */
  private display(): void {
    const percentage = Math.round((this.current / this.total) * 100);
    const elapsed = Date.now() - this.startTime;
    
    let message = `🔄 ${this.name}: ${this.current.toLocaleString()}/${this.total.toLocaleString()} (${percentage}%)`;
    
    if (this.showETA && this.current > 0) {
      const rate = this.current / (elapsed / 1000);
      const remaining = (this.total - this.current) / rate;
      const eta = this.formatTime(remaining);
      message += ` - ETA: ${eta}`;
    }

    // Clear line and print
    process.stdout.write('\r' + ' '.repeat(100) + '\r');
    process.stdout.write(message);
    
    if (this.current >= this.total) {
      const totalTime = this.formatTime(elapsed / 1000);
      console.log(`\n✅ ${this.name} completed in ${totalTime}`);
    }
  }

  /**
   * Format time duration
   */
  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Complete the progress tracker
   */
  complete(): void {
    this.current = this.total;
    this.display();
  }

  /**
   * Get current progress percentage
   */
  getPercentage(): number {
    return Math.round((this.current / this.total) * 100);
  }
}

export class BatchProcessor<T> {
  private processed: number = 0;
  private progress: ProgressTracker;

  constructor(
    private items: T[],
    private batchSize: number,
    private processBatch: (batch: T[]) => Promise<void>,
    progressName: string = 'Processing'
  ) {
    this.progress = new ProgressTracker(progressName, items.length);
  }

  /**
   * Process all items in batches
   */
  async processAll(): Promise<void> {
    for (let i = 0; i < this.items.length; i += this.batchSize) {
      const batch = this.items.slice(i, i + this.batchSize);
      
      await this.processBatch(batch);
      
      this.processed += batch.length;
      this.progress.setCurrent(this.processed);
    }
    
    this.progress.complete();
  }
}

export function createSpinner(text: string): { stop: () => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} ${text}`);
    i = (i + 1) % frames.length;
  }, 100);

  return {
    stop: () => {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(text.length + 2) + '\r');
    }
  };
}