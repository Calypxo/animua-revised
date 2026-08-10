const PREFIX = "animua_contact_reply_draft:";

export function shouldSendReplyOnKeydown(event) {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing;
}

export function getReplyDraft(storage, messageId) {
  if (!messageId) return "";
  return storage.getItem(`${PREFIX}${messageId}`) || "";
}

export function saveReplyDraft(storage, messageId, value) {
  if (!messageId) return;
  const text = String(value || "");
  if (text.trim()) storage.setItem(`${PREFIX}${messageId}`, text);
  else storage.removeItem(`${PREFIX}${messageId}`);
}

export function clearReplyDraft(storage, messageId) {
  if (messageId) storage.removeItem(`${PREFIX}${messageId}`);
}
