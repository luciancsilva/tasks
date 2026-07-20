export interface Comment {
    uid: string;
    task_id: number;
    user_id: number;
    content: string;
    created_at: string;
    updated_at: string;
    user?: { id: number; name: string; email: string };
}
