import { TaskStatus } from '@prisma/client';

// Map of allowed transitions
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.BLOCKED],
  [TaskStatus.IN_REVIEW]: [TaskStatus.DONE, TaskStatus.BLOCKED],
  // From BLOCKED, we can transition back to any active state to resume work
  [TaskStatus.BLOCKED]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW],
  // From DONE, we can reopen to TODO if needed, but let's restrict it or keep it simple
  [TaskStatus.DONE]: [TaskStatus.TODO]
};

export const isValidTransition = (currentStatus: TaskStatus, newStatus: TaskStatus): boolean => {
  // If no change in status, it is always valid
  if (currentStatus === newStatus) {
    return true;
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(newStatus) : false;
};
