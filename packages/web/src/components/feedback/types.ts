export type FeedbackCategory = "bug" | "visual" | "suggestion";
export type FeedbackPriority = "urgent" | "high" | "medium" | "low" | "none";
export type FeedbackLabel = "frontend" | "backend" | "mobile" | "design" | "performance" | "accessibility" | "ux";

export interface ConsoleEntry {
  level: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: string;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  statusText: string;
  duration: number;
  timestamp: string;
}

export interface FeedbackMetadata {
  url: string;
  browser: string;
  viewport: string;
  timestamp: string;
  userAgent: string;
  consoleLogs?: ConsoleEntry[];
  networkErrors?: NetworkEntry[];
}

export interface FeedbackSubmission {
  category: FeedbackCategory;
  title: string;
  description: string;
  screenshot?: string;
  metadata: FeedbackMetadata;
  reporter: {
    name: string;
    email: string;
  };
  priority?: FeedbackPriority;
  requiresPlanning?: boolean;
  labels?: FeedbackLabel[];
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnnotationTool = "marker" | "arrow" | "text";

export interface Point {
  x: number;
  y: number;
}

export interface MarkerAnnotation {
  type: "marker";
  points: Point[];
}

export interface ArrowAnnotation {
  type: "arrow";
  start: Point;
  end: Point;
}

export interface TextAnnotation {
  type: "text";
  position: Point;
  text: string;
}

export type Annotation = MarkerAnnotation | ArrowAnnotation | TextAnnotation;
