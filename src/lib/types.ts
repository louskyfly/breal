export type User = {
  id: number;
  name: string;
  username: string;
  color: string;
  role?: "admin" | "student";
};

export type AdminAccount = {
  id: number;
  name: string;
  username: string;
  color: string;
  pin: string;
  role: "admin" | "student";
  lastSeen: number;
  posted: boolean;
};

export type Comment = {
  id: number;
  text: string;
  createdAt: number;
  user: User;
};

export type ReactionGroup = {
  emoji: string;
  count: number;
  users: User[];
};

export type Post = {
  id: number;
  user: User;
  backUrl: string;
  frontUrl: string;
  caption: string;
  location: string;
  visibility: "friends" | "public";
  retakes: number;
  frontMain: boolean;
  lateSeconds: number;
  createdAt: number;
  reactions: ReactionGroup[];
  myReaction: string | null;
  comments: Comment[];
};

export type Moment = {
  id: number;
  day: string;
  notifiedAt: number;
  lateWindow: number;
};

export type Friend = User & {
  lastSeen: number;
  post: { id: number; lateSeconds: number; createdAt: number } | null;
};

export type Stats = {
  streak: number;
  posts: number;
  friends: number;
  myDays: string[];
};

export type Bootstrap = {
  me: User;
  moment: Moment;
  feed: Post[];
  discovery: Post[];
  memories: Post[];
  stats: Stats;
  friends: Friend[];
  online: User[];
  myTodayPostId: number | null;
  serverNow: number;
  inviteCode: string;
};

export type Me = User;
