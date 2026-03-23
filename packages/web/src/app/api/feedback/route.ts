import { NextRequest, NextResponse } from "next/server";
import type { FeedbackSubmission, FeedbackCategory, FeedbackPriority } from "@/components/feedback/types";

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID;
const LINEAR_PROJECT_ID = process.env.LINEAR_PROJECT_ID;

const LINEAR_LABELS: Record<string, string | undefined> = {
  bug: process.env.LINEAR_LABEL_BUG,
  "visual-issue": process.env.LINEAR_LABEL_VISUAL,
  suggestion: process.env.LINEAR_LABEL_SUGGESTION,
  frontend: process.env.LINEAR_LABEL_FRONTEND,
  backend: process.env.LINEAR_LABEL_BACKEND,
  design: process.env.LINEAR_LABEL_DESIGN,
  performance: process.env.LINEAR_LABEL_PERFORMANCE,
  accessibility: process.env.LINEAR_LABEL_ACCESSIBILITY,
  ux: process.env.LINEAR_LABEL_UX,
};

const LINEAR_ENV_LABELS: Record<string, string | undefined> = {
  production: process.env.LINEAR_LABEL_ENV_PRODUCTION,
  staging: process.env.LINEAR_LABEL_ENV_STAGING,
  development: process.env.LINEAR_LABEL_ENV_DEVELOPMENT,
};

const APP_ENVIRONMENT = process.env.NODE_ENV === "production" ? "production" : "development";

const CATEGORY_LABELS: Record<FeedbackCategory, { label: string; priority: number }> = {
  bug: { label: "bug", priority: 3 },
  visual: { label: "visual-issue", priority: 3 },
  suggestion: { label: "suggestion", priority: 4 },
};

const PRIORITY_MAP: Record<FeedbackPriority, number | null> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
  none: null,
};

const LINEAR_STATE_REQUIRES_PLANNING = process.env.LINEAR_STATE_REQUIRES_PLANNING;

const CATEGORY_TITLES: Record<FeedbackCategory, string> = {
  bug: "Bug",
  visual: "Visual Issue",
  suggestion: "Suggestion",
};

async function uploadToLinear(
  apiKey: string,
  filename: string,
  contentType: string,
  data: Buffer
): Promise<string | null> {
  try {
    const uploadRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({
        query: `mutation($filename: String!, $contentType: String!, $size: Int!) {
          fileUpload(filename: $filename, contentType: $contentType, size: $size) {
            success
            uploadFile {
              uploadUrl
              assetUrl
              headers {
                key
                value
              }
            }
          }
        }`,
        variables: { filename, contentType, size: data.length },
      }),
    });

    const uploadData = await uploadRes.json();
    if (!uploadData.data?.fileUpload?.success) {
      console.error("[Linear] fileUpload failed:", uploadData);
      return null;
    }

    const { uploadUrl, assetUrl, headers: uploadHeaders } = uploadData.data.fileUpload.uploadFile;

    const putHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
    };

    if (uploadHeaders) {
      for (const { key, value } of uploadHeaders) {
        putHeaders[key] = value;
      }
    }

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: putHeaders,
      body: new Uint8Array(data),
    });

    if (!putRes.ok) {
      console.error("[Linear] PUT failed:", putRes.status, await putRes.text());
      return null;
    }

    return assetUrl;
  } catch (error) {
    console.error("[Linear] Upload error:", error);
    return null;
  }
}

async function createLinearIssue(submission: FeedbackSubmission): Promise<string | null> {
  if (!LINEAR_API_KEY || !LINEAR_TEAM_ID) return null;

  const apiKey = LINEAR_API_KEY;
  const { category, title, description, screenshot, metadata, reporter, priority, requiresPlanning, labels } = submission;
  const categoryConfig = CATEGORY_LABELS[category];
  const categoryTitle = CATEGORY_TITLES[category];

  let screenshotUrl = "";
  if (screenshot) {
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const url = await uploadToLinear(apiKey, `screenshot-${Date.now()}.png`, "image/png", buffer);
    if (url) {
      screenshotUrl = url;
    }
  }

  let issueBody = `**Reporter:** ${reporter.name} (${reporter.email})
**Page:** ${metadata.url}
**Browser:** ${metadata.browser}
**Viewport:** ${metadata.viewport}

---

${description}`;

  if (screenshotUrl) {
    issueBody += `\n\n---\n\n![Screenshot](${screenshotUrl})`;
  }

  const consoleLogs = metadata.consoleLogs || [];
  const consoleErrors = consoleLogs.filter((l) => l.level === "error");
  const consoleWarnings = consoleLogs.filter((l) => l.level === "warn");
  const networkErrors = metadata.networkErrors || [];

  issueBody += `\n\n---\n\n**Diagnostics:** ${consoleLogs.length} console entries (${consoleErrors.length} errors, ${consoleWarnings.length} warnings), ${networkErrors.length} failed requests`;

  if (consoleErrors.length > 0) {
    issueBody += "\n\n**Console Errors:**\n```\n";
    consoleErrors.slice(0, 10).forEach((err) => {
      issueBody += `[ERROR] ${err.message.slice(0, 300)}\n`;
    });
    if (consoleErrors.length > 10) {
      issueBody += `... and ${consoleErrors.length - 10} more errors\n`;
    }
    issueBody += "```";
  }

  if (consoleErrors.length === 0 && consoleWarnings.length > 0) {
    issueBody += "\n\n**Console Warnings:**\n```\n";
    consoleWarnings.slice(0, 5).forEach((warn) => {
      issueBody += `[WARN] ${warn.message.slice(0, 300)}\n`;
    });
    if (consoleWarnings.length > 5) {
      issueBody += `... and ${consoleWarnings.length - 5} more warnings\n`;
    }
    issueBody += "```";
  }

  if (networkErrors.length > 0) {
    issueBody += "\n\n**Network Errors:**\n```\n";
    networkErrors.slice(0, 10).forEach((err) => {
      issueBody += `${err.method} ${err.url.slice(0, 100)} → ${err.status} ${err.statusText}\n`;
    });
    if (networkErrors.length > 10) {
      issueBody += `... and ${networkErrors.length - 10} more\n`;
    }
    issueBody += "```";
  }

  const labelIds: string[] = [];
  const envLabel = LINEAR_ENV_LABELS[APP_ENVIRONMENT];
  if (envLabel) labelIds.push(envLabel);
  const catLabel = LINEAR_LABELS[categoryConfig.label];
  if (catLabel) labelIds.push(catLabel);

  if (labels && labels.length > 0) {
    for (const label of labels) {
      const labelId = LINEAR_LABELS[label];
      if (labelId && !labelIds.includes(labelId)) {
        labelIds.push(labelId);
      }
    }
  }

  const issuePriority = priority && PRIORITY_MAP[priority] !== null
    ? PRIORITY_MAP[priority]!
    : categoryConfig.priority;

  const variables: Record<string, unknown> = {
    title: `[${categoryTitle}] ${title}`,
    description: issueBody,
    teamId: LINEAR_TEAM_ID,
    priority: issuePriority,
    labelIds,
  };

  if (LINEAR_PROJECT_ID) variables.projectId = LINEAR_PROJECT_ID;

  if (requiresPlanning && LINEAR_STATE_REQUIRES_PLANNING) {
    variables.stateId = LINEAR_STATE_REQUIRES_PLANNING;
  }

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({
      query: `mutation($title: String!, $description: String!, $teamId: String!, $priority: Int!, $labelIds: [String!], $projectId: String, $stateId: String) {
        issueCreate(input: {
          title: $title
          description: $description
          teamId: $teamId
          priority: $priority
          labelIds: $labelIds
          projectId: $projectId
          stateId: $stateId
        }) {
          success
          issue { id, identifier, url }
        }
      }`,
      variables,
    }),
  });

  const data = await res.json();
  return data.data?.issueCreate?.success ? data.data.issueCreate.issue.url : null;
}

export async function POST(request: NextRequest) {
  try {
    const submission: FeedbackSubmission = await request.json();

    if (!submission.category || !submission.title || !submission.description) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const issueUrl = await createLinearIssue(submission);

    if (issueUrl) {
      return NextResponse.json({ success: true, issueUrl });
    }

    return NextResponse.json(
      { success: false, error: "Failed to create feedback issue. Please try again later." },
      { status: 502 }
    );
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
