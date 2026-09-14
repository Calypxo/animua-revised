// Allow time for a cold start and the backend's 90-second inference timeout.
const PENDING_ANALYSIS_WINDOW_MS = 150_000;

function getSurrenderAnalysisState(record = {}, now = Date.now()) {
  const source = String(record.nlp?.source || "");
  const provisional = /node fallback|analysis pending/i.test(source);
  if (source && !provisional) return "completed";
  if (record.nlpStatus === "fallback") return "fallback";
  const started = record.nlpRequestedAt || record.createdAt;
  const startedAt = started?.toDate ? started.toDate().getTime() : new Date(started).getTime();
  if (provisional && Number.isFinite(startedAt) && now - startedAt < PENDING_ANALYSIS_WINDOW_MS) {
    return "pending";
  }
  return "fallback";
}

module.exports = { getSurrenderAnalysisState };
