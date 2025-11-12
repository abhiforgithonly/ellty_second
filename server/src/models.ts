export interface User {
  id: number;
  username: string;
  password: string;
  createdAt: string;
}

export interface Discussion {
  id: number;
  userId: number;
  username: string;
  startNumber: number;
  createdAt: string;
}

export enum Operation {
  ADD = 'ADD',
  SUBTRACT = 'SUBTRACT',
  MULTIPLY = 'MULTIPLY',
  DIVIDE = 'DIVIDE'
}

export interface Comment {
  id: number;
  discussionId: number;
  parentId: number | null;
  userId: number;
  username: string;
  operation: Operation;
  operand: number;
  result: number;
  createdAt: string;
}

export interface CommentTree extends Comment {
  children: CommentTree[];
}

export interface DiscussionWithComments extends Discussion {
  comments: CommentTree[];
}