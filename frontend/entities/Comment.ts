export interface Comment {
    uid: string;
    task_id: number;
    user_id: number;
    content: string;
    created_at: string;
    updated_at: string;
    user?: { uid: string; name: string; email: string };
}
