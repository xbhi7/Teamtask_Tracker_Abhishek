import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';

export const getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  const currentUser = req.user!;

  try {
    // Fetch overdue counts and average task completion durations per user
    const analytics = await prisma.$queryRawUnsafe<any[]>(
      `
      WITH overdue_cte AS (
        SELECT 
          assignee_id,
          COUNT(id) as overdue_count
        FROM tasks
        WHERE status != 'DONE' AND due_date < NOW() AND organization_id = $1
        GROUP BY assignee_id
      ),
      completion_cte AS (
        SELECT 
          assignee_id,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_completion_hours
        FROM tasks
        WHERE status = 'DONE' AND organization_id = $1
        GROUP BY assignee_id
      )
      SELECT 
        u.id as "userId",
        u.email,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.role,
        COALESCE(o.overdue_count, 0)::integer as "overdueCount",
        ROUND(COALESCE(c.avg_completion_hours, 0.0)::numeric, 2)::float as "avgCompletionTimeHours"
      FROM users u
      LEFT JOIN overdue_cte o ON o.assignee_id = u.id
      LEFT JOIN completion_cte c ON c.assignee_id = u.id
      WHERE u.organization_id = $1
      ORDER BY "overdueCount" DESC, "avgCompletionTimeHours" ASC
      `,
      currentUser.organizationId
    );

    res.status(200).json(analytics);
  } catch (err) {
    next(err);
  }
};
