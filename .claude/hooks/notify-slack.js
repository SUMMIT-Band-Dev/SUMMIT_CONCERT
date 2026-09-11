#!/usr/bin/env node
// Claude Code hook: 권한 요청(Notification)/작업 완료(Stop) 이벤트를 Slack Webhook으로 전송한다.
// 알림 전송에 실패하더라도 Claude Code 작업 흐름을 막으면 안 되므로 항상 exit 0으로 종료한다.

const https = require("https");
const path = require("path");

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

function postToSlack(webhookUrl, text) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ text });
    const url = new URL(webhookUrl);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 5000,
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve());
      }
    );

    req.on("error", () => resolve());
    req.on("timeout", () => {
      req.destroy();
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

function formatTime() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(/\. /g, "-")
    .replace(".", "")
    .replace(/-(\d+):/, " $1:");
}

function buildMessage(payload) {
  const eventName = payload.hook_event_name;
  const cwd = payload.cwd || process.cwd();
  const project = path.basename(cwd);
  const time = formatTime();

  let title;
  let status;

  if (eventName === "Notification") {
    title = "🔔 Claude Code 권한 요청";
    status = payload.message || "권한 확인이 필요합니다.";
  } else if (eventName === "Stop") {
    title = "✅ Claude Code 작업 완료";
    status = "작업 완료";
  } else {
    return null;
  }

  return (
    `*${title}*\n` +
    `1. 프로젝트: ${project}\n` +
    `2. 상태: ${status}\n` +
    `3. 시간: ${time}`
  );
}

async function main() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    process.exit(0);
  }

  const raw = await readStdin();

  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    process.exit(0);
  }

  const message = buildMessage(payload);
  if (!message) {
    process.exit(0);
  }

  await postToSlack(webhookUrl, message);
  process.exit(0);
}

main().catch(() => process.exit(0));
