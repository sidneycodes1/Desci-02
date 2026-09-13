import { AgentTask } from './types';

type TaskHandler<T = unknown, R = unknown> = (task: AgentTask<T>) => Promise<R>;

class TaskQueue {
  private tasks: Map<string, AgentTask<unknown>> = new Map();
  private handlers: Map<string, TaskHandler<unknown, unknown>> = new Map();

  registerHandler<T, R>(taskType: string, handler: TaskHandler<T, R>): void {
    this.handlers.set(taskType, handler as TaskHandler<unknown, unknown>);
  }

  async enqueue<T = unknown>(
    task: Omit<AgentTask<T>, 'id' | 'createdAt' | 'status'>
  ): Promise<AgentTask<T>> {
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

  async getTask(id: string): Promise<AgentTask<unknown> | undefined> {
    return this.tasks.get(id);
  }

  async listTasks(): Promise<AgentTask<unknown>[]> {
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
    } catch (err: unknown) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : 'Unknown task processing error';
    }
  }
}

export const agentTaskQueue = new TaskQueue();
