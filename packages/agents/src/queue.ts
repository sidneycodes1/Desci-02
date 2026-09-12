import { AgentTask, TaskStatus } from './types';

type TaskHandler<T = any, R = any> = (task: AgentTask<T>) => Promise<R>;

class TaskQueue {
  private tasks: Map<string, AgentTask> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();

  registerHandler(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler);
  }

  async enqueue<T = any>(task: Omit<AgentTask<T>, 'id' | 'createdAt' | 'status'>): Promise<AgentTask<T>> {
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const fullTask: AgentTask<T> = {
      ...task,
      id,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    this.tasks.set(id, fullTask);

    // Auto-process task asynchronously
    setImmediate(() => this.processTask(id));

    return fullTask;
  }

  async getTask(id: string): Promise<AgentTask | undefined> {
    return this.tasks.get(id);
  }

  async listTasks(): Promise<AgentTask[]> {
    return Array.from(this.tasks.values());
  }

  private async processTask(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;

    const handler = this.handlers.get(task.type);
    if (!handler) {
      task.status = 'failed';
      task.error = `No worker registered for agent task type: ${task.type}`;
      return;
    }

    try {
      task.status = 'processing';
      const result = await handler(task);
      task.status = 'completed';
      task.result = result;
    } catch (err: any) {
      task.status = 'failed';
      task.error = err?.message ?? 'Unknown task processing error';
    }
  }
}

export const agentTaskQueue = new TaskQueue();
